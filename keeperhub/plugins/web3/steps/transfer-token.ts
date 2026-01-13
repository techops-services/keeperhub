import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { ERC20_ABI } from "@/lib/contracts";
import { db } from "@/lib/db";
import { workflowExecutions } from "@/lib/db/schema";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type TransferTokenResult =
  | {
      success: true;
      transactionHash: string;
      amount: string;
      symbol: string;
      recipient: string;
    }
  | { success: false; error: string };

export type TransferTokenCoreInput = {
  network: string;
  tokenAddress: string;
  recipientAddress: string;
  amount: string;
};

export type TransferTokenInput = StepInput & TransferTokenCoreInput;

/**
 * Core transfer token logic
 */
async function stepHandler(
  input: TransferTokenInput
): Promise<TransferTokenResult> {
  console.log("[Transfer Token] Starting step with input:", {
    network: input.network,
    tokenAddress: input.tokenAddress,
    recipientAddress: input.recipientAddress,
    amount: input.amount,
    hasContext: !!input._context,
    executionId: input._context?.executionId,
  });

  const { network, tokenAddress, recipientAddress, amount, _context } = input;

  // Validate token address
  if (!ethers.isAddress(tokenAddress)) {
    return {
      success: false,
      error: `Invalid token address: ${tokenAddress}`,
    };
  }

  // Validate recipient address
  if (!ethers.isAddress(recipientAddress)) {
    return {
      success: false,
      error: `Invalid recipient address: ${recipientAddress}`,
    };
  }

  // Validate amount
  if (!amount || amount.trim() === "") {
    return {
      success: false,
      error: "Amount is required",
    };
  }

  // Get organizationId from executionId (passed via _context)
  if (!_context?.executionId) {
    return {
      success: false,
      error: "Execution ID is required to identify the organization",
    };
  }

  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromExecution(_context.executionId);
  } catch (error) {
    console.error("[Transfer Token] Failed to get organization ID:", error);
    return {
      success: false,
      error: `Failed to get organization ID: ${getErrorMessage(error)}`,
    };
  }

  // Get userId from execution for RPC preferences
  let userId: string;
  try {
    const execution = await db
      .select({ userId: workflowExecutions.userId })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, _context.executionId))
      .then((rows) => rows[0]);
    if (!execution) {
      throw new Error("Execution not found");
    }
    userId = execution.userId;
  } catch (error) {
    console.error("[Transfer Token] Failed to get user ID:", error);
    return {
      success: false,
      error: `Failed to get user ID: ${getErrorMessage(error)}`,
    };
  }

  // Get chain ID and resolve RPC config (with user preferences)
  let chainId: number;
  let rpcUrl: string;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Transfer Token] Resolved chain ID:", chainId);

    const rpcConfig = await resolveRpcConfig(chainId, userId);
    if (!rpcConfig) {
      throw new Error(`Chain ${chainId} not found or not enabled`);
    }

    rpcUrl = rpcConfig.primaryRpcUrl;
    console.log(
      "[Transfer Token] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    console.error("[Transfer Token] Failed to resolve RPC config:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Initialize Para signer
  let signer: Awaited<ReturnType<typeof initializeParaSigner>>;
  let signerAddress: string;
  try {
    console.log(
      "[Transfer Token] Initializing Para signer for organization:",
      organizationId
    );
    signer = await initializeParaSigner(organizationId, rpcUrl);
    signerAddress = await signer.getAddress();
    console.log(
      "[Transfer Token] Signer initialized successfully:",
      signerAddress
    );
  } catch (error) {
    console.error(
      "[Transfer Token] Failed to initialize organization wallet:",
      error
    );
    return {
      success: false,
      error: `Failed to initialize organization wallet: ${getErrorMessage(error)}`,
    };
  }

  // Create contract instance with signer
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  try {
    // Get token decimals and symbol
    const [decimals, symbol] = await Promise.all([
      contract.decimals() as Promise<bigint>,
      contract.symbol() as Promise<string>,
    ]);

    const decimalsNum = Number(decimals);
    console.log("[Transfer Token] Token info:", {
      symbol,
      decimals: decimalsNum,
    });

    // Convert amount to raw units
    let amountRaw: bigint;
    try {
      amountRaw = ethers.parseUnits(amount, decimalsNum);
    } catch (error) {
      return {
        success: false,
        error: `Invalid amount format: ${getErrorMessage(error)}`,
      };
    }

    // Check balance before transfer
    const balance = (await contract.balanceOf(signerAddress)) as bigint;
    if (balance < amountRaw) {
      const balanceFormatted = ethers.formatUnits(balance, decimalsNum);
      return {
        success: false,
        error: `Insufficient ${symbol} balance. Have: ${balanceFormatted}, Need: ${amount}`,
      };
    }

    console.log("[Transfer Token] Executing transfer:", {
      from: signerAddress,
      to: recipientAddress,
      amount,
      amountRaw: amountRaw.toString(),
      symbol,
    });

    // Execute transfer
    const tx = await contract.transfer(recipientAddress, amountRaw);

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    if (!receipt) {
      return {
        success: false,
        error: "Transaction sent but receipt not available",
      };
    }

    console.log("[Transfer Token] Transaction confirmed:", receipt.hash);

    return {
      success: true,
      transactionHash: receipt.hash,
      amount,
      symbol,
      recipient: recipientAddress,
    };
  } catch (error) {
    console.error("[Transfer Token] Transaction failed:", error);
    return {
      success: false,
      error: `Token transfer failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Transfer Token Step
 * Transfers ERC20 tokens from the organization wallet to a recipient address
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function transferTokenStep(
  input: TransferTokenInput
): Promise<TransferTokenResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
