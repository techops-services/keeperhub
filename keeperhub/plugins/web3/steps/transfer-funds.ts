import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { db } from "@/lib/db";
import { explorerConfigs, workflowExecutions } from "@/lib/db/schema";
import { getTransactionUrl } from "@/lib/explorer";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type TransferFundsResult =
  | { success: true; transactionHash: string; transactionLink: string }
  | { success: false; error: string };

export type TransferFundsCoreInput = {
  network: string;
  amount: string;
  recipientAddress: string;
};

export type TransferFundsInput = StepInput & TransferFundsCoreInput;

/**
 * Core transfer logic
 */
async function stepHandler(
  input: TransferFundsInput
): Promise<TransferFundsResult> {
  console.log("[Transfer Funds] Starting step with input:", {
    network: input.network,
    amount: input.amount,
    recipientAddress: input.recipientAddress,
    hasContext: !!input._context,
    executionId: input._context?.executionId,
  });

  const { network, amount, recipientAddress, _context } = input;

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

  let amountInWei: bigint;
  try {
    amountInWei = ethers.parseEther(amount);
  } catch (error) {
    return {
      success: false,
      error: `Invalid amount format: ${getErrorMessage(error)}`,
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
    console.error("[Transfer Funds] Failed to get organization ID:", error);
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
    console.error("[Transfer Funds] Failed to get user ID:", error);
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
    console.log("[Transfer Funds] Resolved chain ID:", chainId);

    const rpcConfig = await resolveRpcConfig(chainId, userId);
    if (!rpcConfig) {
      throw new Error(`Chain ${chainId} not found or not enabled`);
    }

    rpcUrl = rpcConfig.primaryRpcUrl;
    console.log(
      "[Transfer Funds] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    console.error("[Transfer Funds] Failed to resolve RPC config:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  let signer: Awaited<ReturnType<typeof initializeParaSigner>> | null = null;
  try {
    console.log(
      "[Transfer Funds] Initializing Para signer for organization:",
      organizationId
    );
    signer = await initializeParaSigner(organizationId, rpcUrl);
    const signerAddress = await signer.getAddress();
    console.log(
      "[Transfer Funds] Signer initialized successfully:",
      signerAddress
    );
  } catch (error) {
    console.error(
      "[Transfer Funds] Failed to initialize organization wallet:",
      error
    );
    return {
      success: false,
      error: `Failed to initialize organization wallet: ${getErrorMessage(error)}`,
    };
  }

  // Send transaction
  try {
    const tx = await signer.sendTransaction({
      to: recipientAddress,
      value: amountInWei,
    });

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    if (!receipt) {
      return {
        success: false,
        error: "Transaction sent but receipt not available",
      };
    }

    console.log("[Transfer Funds] Transaction confirmed:", receipt.hash);

    // Fetch explorer config for transaction link
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    const transactionLink = explorerConfig
      ? getTransactionUrl(explorerConfig, receipt.hash)
      : "";

    return {
      success: true,
      transactionHash: receipt.hash,
      transactionLink,
    };
  } catch (error) {
    console.error("[Transfer Funds] Transaction failed:", error);
    return {
      success: false,
      error: `Transaction failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Transfer Funds Step
 * Transfers ETH from the user's wallet to a recipient address
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function transferFundsStep(
  input: TransferFundsInput
): Promise<TransferFundsResult> {
  "use step";

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "transfer-funds",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => stepHandler(input))
  );
}

export const _integrationType = "web3";
