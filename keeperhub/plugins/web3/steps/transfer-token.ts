import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { ethers } from "ethers";
import { ErrorCategory, logUserError } from "@/keeperhub/lib/logging";
import {
  getOrganizationWalletAddress,
  initializeParaSigner,
} from "@/keeperhub/lib/para/wallet-helpers";
import { resolveGasLimitOverrides } from "@/keeperhub/lib/web3/gas-defaults";
import { getGasStrategy } from "@/keeperhub/lib/web3/gas-strategy";
import { getNonceManager } from "@/keeperhub/lib/web3/nonce-manager";
import {
  type TransactionContext,
  withNonceSession,
} from "@/keeperhub/lib/web3/transaction-manager";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { ERC20_ABI } from "@/lib/contracts";
import { db } from "@/lib/db";
import {
  explorerConfigs,
  supportedTokens,
  workflowExecutions,
} from "@/lib/db/schema";
import { getAddressUrl, getTransactionUrl } from "@/lib/explorer";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type TransferTokenResult =
  | {
      success: true;
      transactionHash: string;
      transactionLink: string;
      amount: string;
      symbol: string;
      recipient: string;
    }
  | { success: false; error: string };

export type TransferTokenCoreInput = {
  network: string;
  tokenConfig: string | Record<string, unknown>;
  recipientAddress: string;
  amount: string;
  gasLimitMultiplier?: string;
  // Legacy support
  tokenAddress?: string;
};

export type TransferTokenInput = StepInput & TransferTokenCoreInput;

/**
 * Parse token config from input and return a single token address
 * Supports both new (single token) and legacy (array) formats
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles multiple token config formats for backwards compatibility
async function parseTokenAddress(
  input: TransferTokenInput,
  chainId: number
): Promise<string | null> {
  // Legacy support: if tokenAddress is provided directly, use it
  if (input.tokenAddress && !input.tokenConfig) {
    return input.tokenAddress;
  }

  if (!input.tokenConfig) {
    return null;
  }

  // Object values from API/MCP-created workflows -- normalize to parsed form
  const parsed =
    typeof input.tokenConfig === "object"
      ? input.tokenConfig
      : (() => {
          try {
            return JSON.parse(input.tokenConfig as string);
          } catch {
            return null;
          }
        })();

  if (!parsed) {
    // JSON parse failed -- check if it's a bare address string
    if (
      typeof input.tokenConfig === "string" &&
      input.tokenConfig.startsWith("0x")
    ) {
      return input.tokenConfig;
    }
    return null;
  }

  // New format: single supported token ID
  if (parsed.supportedTokenId) {
    const tokens = await db
      .select({ tokenAddress: supportedTokens.tokenAddress })
      .from(supportedTokens)
      .where(
        and(
          eq(supportedTokens.chainId, chainId),
          eq(supportedTokens.id, parsed.supportedTokenId)
        )
      )
      .limit(1);
    if (tokens[0]?.tokenAddress) {
      return tokens[0].tokenAddress;
    }
  }

  // Legacy format: array of supported token IDs - use first
  if (
    Array.isArray(parsed.supportedTokenIds) &&
    parsed.supportedTokenIds.length > 0
  ) {
    const tokens = await db
      .select({ tokenAddress: supportedTokens.tokenAddress })
      .from(supportedTokens)
      .where(
        and(
          eq(supportedTokens.chainId, chainId),
          inArray(supportedTokens.id, parsed.supportedTokenIds)
        )
      )
      .limit(1);
    if (tokens[0]?.tokenAddress) {
      return tokens[0].tokenAddress;
    }
  }

  // New format: single custom token
  if (parsed.customToken?.address) {
    return parsed.customToken.address;
  }

  // Legacy format: array of custom tokens - use first
  if (Array.isArray(parsed.customTokens) && parsed.customTokens.length > 0) {
    return parsed.customTokens[0].address;
  }

  // Legacy: check old formats
  if (
    Array.isArray(parsed.customTokenAddresses) &&
    parsed.customTokenAddresses.length > 0
  ) {
    const addr = parsed.customTokenAddresses.find(
      (a: string) => a && a.trim() !== ""
    );
    if (addr) {
      return addr;
    }
  } else if (parsed.customTokenAddress) {
    return parsed.customTokenAddress;
  }

  return null;
}

/**
 * Core transfer token logic
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Step handler with comprehensive validation and error handling
async function stepHandler(
  input: TransferTokenInput
): Promise<TransferTokenResult> {
  console.log("[Transfer Token] Starting step with input:", {
    network: input.network,
    tokenConfig: input.tokenConfig,
    recipientAddress: input.recipientAddress,
    amount: input.amount,
    hasContext: !!input._context,
    executionId: input._context?.executionId,
  });

  const { network, recipientAddress, amount, gasLimitMultiplier, _context } =
    input;

  const { multiplierOverride, gasLimitOverride } =
    resolveGasLimitOverrides(gasLimitMultiplier);

  // Get chain ID first (needed for token config parsing)
  let chainId: number;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Transfer Token] Resolved chain ID:", chainId);
  } catch (error) {
    logUserError(
      ErrorCategory.VALIDATION,
      "[Transfer Token] Failed to resolve network",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-token",
      }
    );
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Parse token address from config
  const tokenAddress = await parseTokenAddress(input, chainId);

  // Validate token address
  if (!(tokenAddress && ethers.isAddress(tokenAddress))) {
    return {
      success: false,
      error: tokenAddress
        ? `Invalid token address: ${tokenAddress}`
        : "No token selected",
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Transfer Token] Failed to get organization ID",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-token",
        chain_id: String(chainId),
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
      "[Transfer Token] Failed to get user ID",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-token",
        chain_id: String(chainId),
      }
    );
    return {
      success: false,
      error: `Failed to get user ID: ${getErrorMessage(error)}`,
    };
  }

  // Resolve RPC config (with user preferences)
  let rpcUrl: string;
  try {
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Transfer Token] Failed to resolve RPC config",
      error,
      {
        plugin_name: "web3",
        action_name: "transfer-token",
        chain_id: String(chainId),
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
    console.error("[Transfer Token] Failed to get wallet address:", error);
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

      // Get nonce from session
      const nonce = nonceManager.getNextNonce(session);

      // Estimate gas for the transfer
      const estimatedGas = await contract.transfer.estimateGas(
        recipientAddress,
        amountRaw
      );

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

      console.log("[Transfer Token] Gas config:", {
        estimatedGas: estimatedGas.toString(),
        gasLimit: txGasConfig.gasLimit.toString(),
        maxFeePerGas: `${ethers.formatUnits(txGasConfig.maxFeePerGas, "gwei")} gwei`,
        maxPriorityFeePerGas: `${ethers.formatUnits(txGasConfig.maxPriorityFeePerGas, "gwei")} gwei`,
      });

      // Execute transfer with managed nonce and gas config
      const tx = await contract.transfer(recipientAddress, amountRaw, {
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

      console.log("[Transfer Token] Transaction confirmed:", {
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
        amount,
        symbol,
        recipient: recipientAddress,
      };
    } catch (error) {
      logUserError(
        ErrorCategory.TRANSACTION,
        "[Transfer Token] Transaction failed",
        error,
        {
          plugin_name: "web3",
          action_name: "transfer-token",
          chain_id: String(chainId),
        }
      );
      return {
        success: false,
        error: `Token transfer failed: ${getErrorMessage(error)}`,
      };
    }
  });
}

/**
 * Transfer Token Step
 * Transfers ERC20 tokens from the organization wallet to a recipient address
 */
export async function transferTokenStep(
  input: TransferTokenInput
): Promise<TransferTokenResult> {
  "use step";

  let enrichedInput: TransferTokenInput & { recipientAddressLink?: string } =
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

  return withStepLogging(enrichedInput, () => stepHandler(input));
}

export const _integrationType = "web3";
