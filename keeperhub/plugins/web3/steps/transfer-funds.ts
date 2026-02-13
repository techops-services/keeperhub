import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import {
  logConfigurationError,
  logTransactionError,
} from "@/keeperhub/lib/logging";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import {
  getOrganizationWalletAddress,
  initializeParaSigner,
} from "@/keeperhub/lib/para/wallet-helpers";
import { parseGasLimitConfig } from "@/keeperhub/lib/web3/gas-defaults";
import { getGasStrategy } from "@/keeperhub/lib/web3/gas-strategy";
import { getNonceManager } from "@/keeperhub/lib/web3/nonce-manager";
import {
  type TransactionContext,
  withNonceSession,
} from "@/keeperhub/lib/web3/transaction-manager";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { db } from "@/lib/db";
import { explorerConfigs, workflowExecutions } from "@/lib/db/schema";
import { getAddressUrl, getTransactionUrl } from "@/lib/explorer";
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
  gasLimitMultiplier?: string;
};

export type TransferFundsInput = StepInput & TransferFundsCoreInput;

/**
 * Core transfer logic
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Step handler with comprehensive validation and error handling
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

  const { network, amount, recipientAddress, gasLimitMultiplier, _context } =
    input;

  const gasLimitConfig = parseGasLimitConfig(gasLimitMultiplier);
  let multiplierOverride: number | undefined;
  let gasLimitOverride: bigint | undefined;

  if (gasLimitConfig?.mode === "maxGasLimit") {
    const parsed = Number.parseFloat(gasLimitConfig.value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      gasLimitOverride = BigInt(Math.floor(parsed));
    }
  } else if (gasLimitConfig?.mode === "multiplier") {
    const parsed = Number.parseFloat(gasLimitConfig.value);
    if (!Number.isNaN(parsed)) {
      multiplierOverride = Math.max(1.0, Math.min(10.0, parsed));
    }
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
    logConfigurationError(
      "[Transfer Funds] Failed to get organization ID:",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-funds",
      }
    );
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
    logConfigurationError("[Transfer Funds] Failed to get user ID:", error, {
      plugin_name: "web3",
      action_name: "transfer-funds",
    });
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
    logConfigurationError(
      "[Transfer Funds] Failed to resolve RPC config:",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-funds",
      }
    );
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Get wallet address for nonce management
  let walletAddress: string;
  try {
    walletAddress = await getOrganizationWalletAddress(organizationId);
  } catch (error) {
    console.error("[Transfer Funds] Failed to get wallet address:", error);
    return {
      success: false,
      error: `Failed to get wallet address: ${getErrorMessage(error)}`,
    };
  }

  // Get workflow ID for transaction tracking
  let workflowId: string | undefined;
  try {
    const execution = await db
      .select({ workflowId: workflowExecutions.workflowId })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, _context.executionId))
      .then((rows) => rows[0]);
    workflowId = execution?.workflowId ?? undefined;
  } catch {
    // Non-critical - workflowId is optional for tracking
  }

  // Build transaction context
  const txContext: TransactionContext = {
    organizationId,
    executionId: _context.executionId,
    workflowId,
    chainId,
    rpcUrl,
    triggerType: _context.triggerType as TransactionContext["triggerType"],
  };

  // Execute transaction with nonce management and gas strategy
  return withNonceSession(txContext, walletAddress, async (session) => {
    const nonceManager = getNonceManager();
    const gasStrategy = getGasStrategy();

    let signer: Awaited<ReturnType<typeof initializeParaSigner>>;
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

    // Get nonce from session
    const nonce = nonceManager.getNextNonce(session);

    // Send transaction with managed nonce and gas strategy
    try {
      const provider = signer.provider;
      if (!provider) {
        throw new Error("Signer has no provider");
      }

      // Build base transaction
      const baseTx = {
        to: recipientAddress,
        value: amountInWei,
      };

      // Estimate gas
      const estimatedGas = await provider.estimateGas({
        ...baseTx,
        from: walletAddress,
      });

      // Get gas configuration from strategy
      const txGasConfig = await gasStrategy.getGasConfig(
        provider,
        txContext.triggerType ?? "manual",
        estimatedGas,
        chainId,
        multiplierOverride,
        gasLimitOverride
      );

      console.log("[Transfer Funds] Gas config:", {
        estimatedGas: estimatedGas.toString(),
        gasLimit: txGasConfig.gasLimit.toString(),
        maxFeePerGas: `${ethers.formatUnits(txGasConfig.maxFeePerGas, "gwei")} gwei`,
        maxPriorityFeePerGas: `${ethers.formatUnits(txGasConfig.maxPriorityFeePerGas, "gwei")} gwei`,
      });

      // Send transaction with nonce and gas config
      const tx = await signer.sendTransaction({
        ...baseTx,
        nonce,
        gasLimit: txGasConfig.gasLimit,
        maxFeePerGas: txGasConfig.maxFeePerGas,
        maxPriorityFeePerGas: txGasConfig.maxPriorityFeePerGas,
      });

      // Record pending transaction
      await nonceManager.recordTransaction(
        session,
        nonce,
        tx.hash,
        workflowId,
        txGasConfig.maxFeePerGas.toString()
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt) {
        return {
          success: false,
          error: "Transaction sent but receipt not available",
        };
      }

      // Mark transaction as confirmed
      await nonceManager.confirmTransaction(tx.hash);

      console.log("[Transfer Funds] Transaction confirmed:", {
        hash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: `${ethers.formatUnits(receipt.gasPrice, "gwei")} gwei`,
      });

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
      logTransactionError("[Transfer Funds] Transaction failed:", error, {
        plugin_name: "web3",
        action_name: "transfer-funds",
        chain_id: String(chainId),
      });
      return {
        success: false,
        error: `Transaction failed: ${getErrorMessage(error)}`,
      };
    }
  });
}

/**
 * Transfer Funds Step
 * Transfers ETH from the user's wallet to a recipient address
 */
export async function transferFundsStep(
  input: TransferFundsInput
): Promise<TransferFundsResult> {
  "use step";

  // Enrich input with recipient address explorer link for the execution log
  let enrichedInput: TransferFundsInput & { recipientAddressLink?: string } =
    input;
  try {
    const chainId = getChainIdFromNetwork(input.network);
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    if (explorerConfig) {
      const recipientAddressLink = getAddressUrl(
        explorerConfig,
        input.recipientAddress
      );
      if (recipientAddressLink) {
        enrichedInput = { ...input, recipientAddressLink };
      }
    }
  } catch {
    // Non-critical: if lookup fails, input logs without the link
  }

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "transfer-funds",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(enrichedInput, () => stepHandler(input))
  );
}

export const _integrationType = "web3";
