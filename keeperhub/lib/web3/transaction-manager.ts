/**
 * Transaction Manager for KeeperHub Web3 Operations
 *
 * High-level wrapper that coordinates nonce management and gas strategy
 * with transaction execution. Provides a simple interface for workflow
 * steps to execute transactions with proper nonce handling and adaptive
 * gas estimation.
 *
 * @see docs/keeperhub/KEEP-1240/nonce.md for nonce specification
 * @see docs/keeperhub/KEEP-1240/gas.md for gas strategy specification
 */

import { ethers } from "ethers";
import { ErrorCategory, logUserError } from "@/keeperhub/lib/logging";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import {
  type TriggerType as GasTriggerType,
  getGasStrategy,
} from "./gas-strategy";
import { getNonceManager, type NonceSession } from "./nonce-manager";

export type TriggerType = GasTriggerType;

export type TransactionContext = {
  organizationId: string;
  executionId: string;
  workflowId?: string;
  chainId: number;
  rpcUrl: string;
  triggerType?: TriggerType;
};

export type TransactionResult = {
  success: boolean;
  txHash?: string;
  receipt?: ethers.TransactionReceipt;
  error?: string;
  nonce?: number;
};

/**
 * Execute a single transaction with nonce management and gas strategy.
 *
 * @param context - Transaction context with execution and chain info
 * @param walletAddress - The wallet address executing the transaction
 * @param buildTx - Function that builds the transaction given a nonce
 * @param session - Active nonce session
 * @returns Transaction result with success/failure status
 */
export async function executeTransaction(
  context: TransactionContext,
  walletAddress: string,
  buildTx: (nonce: number) => ethers.TransactionRequest,
  session: NonceSession
): Promise<TransactionResult> {
  const nonceManager = getNonceManager();
  const gasStrategy = getGasStrategy();

  // Get next nonce from session
  const nonce = nonceManager.getNextNonce(session);

  try {
    // Build base transaction
    const baseTx = buildTx(nonce);

    // Initialize signer
    const signer = await initializeParaSigner(
      context.organizationId,
      context.rpcUrl
    );
    const provider = signer.provider;

    if (!provider) {
      throw new Error("Signer has no provider");
    }

    // Estimate gas for the transaction
    const estimatedGas = await provider.estimateGas({
      ...baseTx,
      from: walletAddress,
    });

    // Get gas configuration from strategy
    const gasConfig = await gasStrategy.getGasConfig(
      provider,
      context.triggerType ?? "manual",
      estimatedGas,
      context.chainId
    );

    // Build final transaction with nonce and gas config
    const txRequest: ethers.TransactionRequest = {
      ...baseTx,
      nonce,
      gasLimit: gasConfig.gasLimit,
      maxFeePerGas: gasConfig.maxFeePerGas,
      maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
    };

    // Send transaction
    const tx = await signer.sendTransaction(txRequest);

    // Record pending transaction
    await nonceManager.recordTransaction(
      session,
      nonce,
      tx.hash,
      context.workflowId,
      gasConfig.maxFeePerGas.toString()
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    // Mark confirmed
    await nonceManager.confirmTransaction(tx.hash);

    console.log(
      `[TransactionManager] Transaction confirmed: hash=${tx.hash}, ` +
        `nonce=${nonce}, gasUsed=${receipt?.gasUsed}, ` +
        `gasLimit=${gasConfig.gasLimit}`
    );

    return {
      success: true,
      txHash: tx.hash,
      receipt: receipt ?? undefined,
      nonce,
    };
  } catch (error) {
    logUserError(
      ErrorCategory.TRANSACTION,
      "[TransactionManager] Transaction failed:",
      error,
      {
        chain_id: context.chainId.toString(),
        nonce: nonce.toString(),
      }
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      nonce,
    };
  }
}

/**
 * Execute a transaction via contract method call with nonce management and gas strategy.
 *
 * @param context - Transaction context with execution and chain info
 * @param walletAddress - The wallet address executing the transaction
 * @param contract - The ethers contract instance (connected to signer)
 * @param method - The method name to call
 * @param args - Arguments to pass to the method
 * @param session - Active nonce session
 * @returns Transaction result with success/failure status
 */
export async function executeContractTransaction(
  context: TransactionContext,
  _walletAddress: string,
  contract: ethers.Contract,
  method: string,
  args: unknown[],
  session: NonceSession
): Promise<TransactionResult> {
  const nonceManager = getNonceManager();
  const gasStrategy = getGasStrategy();

  // Get next nonce from session
  const nonce = nonceManager.getNextNonce(session);

  try {
    const provider = contract.runner?.provider;
    if (!provider) {
      throw new Error("Contract has no provider");
    }

    // Estimate gas for the contract call
    const estimatedGas = await contract[method].estimateGas(...args);

    // Get gas configuration from strategy
    const gasConfig = await gasStrategy.getGasConfig(
      provider as ethers.Provider,
      context.triggerType ?? "manual",
      estimatedGas,
      context.chainId
    );

    // Call contract method with nonce and gas config
    const tx = await contract[method](...args, {
      nonce,
      gasLimit: gasConfig.gasLimit,
      maxFeePerGas: gasConfig.maxFeePerGas,
      maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
    });

    // Record pending transaction
    await nonceManager.recordTransaction(
      session,
      nonce,
      tx.hash,
      context.workflowId,
      gasConfig.maxFeePerGas.toString()
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    // Mark confirmed
    await nonceManager.confirmTransaction(tx.hash);

    console.log(
      `[TransactionManager] Contract tx confirmed: hash=${tx.hash}, ` +
        `nonce=${nonce}, method=${method}, gasUsed=${receipt?.gasUsed}, ` +
        `gasLimit=${gasConfig.gasLimit}`
    );

    return {
      success: true,
      txHash: tx.hash,
      receipt: receipt ?? undefined,
      nonce,
    };
  } catch (error) {
    logUserError(
      ErrorCategory.TRANSACTION,
      "[TransactionManager] Contract transaction failed:",
      error,
      {
        chain_id: context.chainId.toString(),
        nonce: nonce.toString(),
        method,
      }
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      nonce,
    };
  }
}

/**
 * Wrapper for workflow execution with nonce session management.
 * Handles session lifecycle (start, execute, end) automatically.
 *
 * @param context - Transaction context with execution and chain info
 * @param walletAddress - The wallet address for the session
 * @param fn - Function to execute within the session
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await withNonceSession(context, walletAddress, async (session) => {
 *   // Execute one or more transactions
 *   const result = await executeTransaction(context, walletAddress, (nonce) => ({
 *     to: recipientAddress,
 *     value: ethers.parseEther(amount),
 *   }), session);
 *
 *   return result;
 * });
 * ```
 */
export async function withNonceSession<T>(
  context: TransactionContext,
  walletAddress: string,
  fn: (session: NonceSession) => Promise<T>
): Promise<T> {
  const nonceManager = getNonceManager();
  const provider = new ethers.JsonRpcProvider(context.rpcUrl);

  // Start session (acquires lock, fetches nonce, validates)
  const { session, validation } = await nonceManager.startSession(
    walletAddress,
    context.chainId,
    context.executionId,
    provider
  );

  // Log validation results
  if (!validation.valid) {
    console.warn(
      "[TransactionManager] Starting workflow with warnings:",
      validation.warnings
    );
  }

  try {
    return await fn(session);
  } finally {
    // Always release session
    await nonceManager.endSession(session);
  }
}

/**
 * Get the current nonce from the chain for a wallet.
 * Useful for checking state without acquiring a lock.
 *
 * @param walletAddress - The wallet address
 * @param rpcUrl - RPC endpoint to query
 * @returns Current pending nonce from chain
 */
export async function getCurrentNonce(
  walletAddress: string,
  rpcUrl: string
): Promise<number> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return await provider.getTransactionCount(walletAddress, "pending");
}
