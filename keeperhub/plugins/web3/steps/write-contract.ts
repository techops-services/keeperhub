import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { ErrorCategory, logUserError } from "@/keeperhub/lib/logging";
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

type WriteContractResult =
  | {
      success: true;
      transactionHash: string;
      transactionLink: string;
      result?: unknown;
    }
  | { success: false; error: string };

export type WriteContractCoreInput = {
  contractAddress: string;
  network: string;
  abi: string;
  abiFunction: string;
  functionArgs?: string;
  gasLimitMultiplier?: string;
};

export type WriteContractInput = StepInput & WriteContractCoreInput;

/**
 * Core write contract logic
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Contract interaction requires extensive validation
async function stepHandler(
  input: WriteContractInput
): Promise<WriteContractResult> {
  const {
    contractAddress,
    network,
    abi,
    abiFunction,
    functionArgs,
    gasLimitMultiplier,
    _context,
  } = input;

  const gasConfig = parseGasLimitConfig(gasLimitMultiplier);
  let multiplierOverride: number | undefined;
  let gasLimitOverride: bigint | undefined;

  if (gasConfig?.mode === "maxGasLimit") {
    const parsed = Number.parseFloat(gasConfig.value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      gasLimitOverride = BigInt(Math.floor(parsed));
    }
  } else if (gasConfig?.mode === "multiplier") {
    const parsed = Number.parseFloat(gasConfig.value);
    if (!Number.isNaN(parsed)) {
      multiplierOverride = Math.max(1.0, Math.min(10.0, parsed));
    }
  }

  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    return {
      success: false,
      error: `Invalid contract address: ${contractAddress}`,
    };
  }

  // Parse ABI
  let parsedAbi: unknown;
  try {
    parsedAbi = JSON.parse(abi);
  } catch (error) {
    return {
      success: false,
      error: `Invalid ABI JSON: ${getErrorMessage(error)}`,
    };
  }

  // Validate ABI is an array
  if (!Array.isArray(parsedAbi)) {
    return {
      success: false,
      error: "ABI must be a JSON array",
    };
  }

  // Find the selected function in the ABI
  const functionAbi = parsedAbi.find(
    (item: { type: string; name: string }) =>
      item.type === "function" && item.name === abiFunction
  );

  if (!functionAbi) {
    return {
      success: false,
      error: `Function '${abiFunction}' not found in ABI`,
    };
  }

  // Parse function arguments
  let args: unknown[] = [];
  if (functionArgs && functionArgs.trim() !== "") {
    try {
      const parsedArgs = JSON.parse(functionArgs);
      if (!Array.isArray(parsedArgs)) {
        return {
          success: false,
          error: "Function arguments must be a JSON array",
        };
      }
      // Filter out empty strings at the end of the array (from UI padding)
      args = parsedArgs.filter((arg, index) => {
        // Keep all non-empty values
        if (arg !== "") {
          return true;
        }
        // Keep empty strings if they're not at the end
        return parsedArgs.slice(index + 1).some((a) => a !== "");
      });
    } catch (error) {
      return {
        success: false,
        error: `Invalid function arguments JSON: ${getErrorMessage(error)}`,
      };
    }
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Write Contract] Failed to get organization ID:",
      error,
      {
        plugin_name: "web3",
        action_name: "write-contract",
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Write Contract] Failed to get user ID:",
      error,
      {
        plugin_name: "web3",
        action_name: "write-contract",
      }
    );
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
    console.log("[Write Contract] Resolved chain ID:", chainId);

    const rpcConfig = await resolveRpcConfig(chainId, userId);
    if (!rpcConfig) {
      throw new Error(`Chain ${chainId} not found or not enabled`);
    }

    rpcUrl = rpcConfig.primaryRpcUrl;
    console.log(
      "[Write Contract] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    logUserError(
      ErrorCategory.VALIDATION,
      "[Write Contract] Failed to resolve RPC config:",
      error,
      {
        plugin_name: "web3",
        action_name: "write-contract",
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
    console.error("[Write Contract] Failed to get wallet address:", error);
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

    // Initialize Para signer
    let signer: Awaited<ReturnType<typeof initializeParaSigner>>;
    try {
      signer = await initializeParaSigner(organizationId, rpcUrl);
    } catch (error) {
      console.error(
        "[Write Contract] Failed to initialize organization wallet:",
        error
      );
      return {
        success: false,
        error: `Failed to initialize organization wallet: ${getErrorMessage(error)}`,
      };
    }

    // Create contract instance with signer
    let contract: ethers.Contract;
    try {
      contract = new ethers.Contract(contractAddress, parsedAbi, signer);
    } catch (error) {
      console.error(
        "[Write Contract] Failed to create contract instance:",
        error
      );
      return {
        success: false,
        error: `Failed to create contract instance: ${getErrorMessage(error)}`,
      };
    }

    // Call the contract function
    try {
      // Check if function exists
      if (typeof contract[abiFunction] !== "function") {
        return {
          success: false,
          error: `Function '${abiFunction}' not found in contract ABI`,
        };
      }

      // Get nonce from session
      const nonce = nonceManager.getNextNonce(session);

      // Estimate gas for the contract call
      const estimatedGas = await contract[abiFunction].estimateGas(...args);

      // Get gas configuration from strategy
      const provider = signer.provider;
      if (!provider) {
        throw new Error("Signer has no provider");
      }

      const txGasConfig = await gasStrategy.getGasConfig(
        provider,
        txContext.triggerType ?? "manual",
        estimatedGas,
        chainId,
        multiplierOverride,
        gasLimitOverride
      );

      console.log("[Write Contract] Gas config:", {
        function: abiFunction,
        estimatedGas: estimatedGas.toString(),
        gasLimit: txGasConfig.gasLimit.toString(),
        maxFeePerGas: `${ethers.formatUnits(txGasConfig.maxFeePerGas, "gwei")} gwei`,
        maxPriorityFeePerGas: `${ethers.formatUnits(txGasConfig.maxPriorityFeePerGas, "gwei")} gwei`,
      });

      // Execute contract call with managed nonce and gas config
      const tx = await contract[abiFunction](...args, {
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

      // Mark transaction as confirmed
      await nonceManager.confirmTransaction(tx.hash);

      console.log("[Write Contract] Transaction confirmed:", {
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
        result: undefined,
      };
    } catch (error) {
      logUserError(
        ErrorCategory.NETWORK_RPC,
        "[Write Contract] Function call failed:",
        error,
        {
          plugin_name: "web3",
          action_name: "write-contract",
          chain_id: String(chainId),
        }
      );
      return {
        success: false,
        error: `Contract call failed: ${getErrorMessage(error)}`,
      };
    }
  });
}

/**
 * Write Contract Step
 * Writes data to a smart contract using state-changing functions
 */
export async function writeContractStep(
  input: WriteContractInput
): Promise<WriteContractResult> {
  "use step";

  // Enrich input with contract address explorer link for the execution log
  let enrichedInput: WriteContractInput & { contractAddressLink?: string } =
    input;
  try {
    const chainId = getChainIdFromNetwork(input.network);
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    if (explorerConfig) {
      const contractAddressLink = getAddressUrl(
        explorerConfig,
        input.contractAddress
      );
      if (contractAddressLink) {
        enrichedInput = { ...input, contractAddressLink };
      }
    }
  } catch {
    // Non-critical: if lookup fails, input logs without the link
  }

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "write-contract",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(enrichedInput, () => stepHandler(input))
  );
}

export const _integrationType = "web3";
