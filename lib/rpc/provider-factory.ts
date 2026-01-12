/**
 * RPC Provider Factory
 *
 * Creates RpcProviderManager or SolanaProviderManager instances with proper
 * configuration resolved from user preferences or chain defaults.
 */

import {
  consoleMetricsCollector,
  consoleSolanaMetricsCollector,
  createRpcProviderManager,
  createSolanaProviderManager,
  type FailoverStateChangeCallback,
  type RpcProviderManager,
  type SolanaFailoverStateChangeCallback,
  type SolanaProviderManager,
} from "@/lib/rpc-provider";
import { resolveRpcConfig } from "./config-service";

// Solana chain IDs (non-EVM)
const SOLANA_CHAIN_IDS = new Set([101, 103]);

/**
 * Check if a chain ID is a Solana chain
 */
export function isSolanaChain(chainId: number): boolean {
  return SOLANA_CHAIN_IDS.has(chainId);
}

export type GetProviderOptions = {
  chainId: number;
  userId?: string;
  onFailoverStateChange?: FailoverStateChangeCallback;
};

export type GetSolanaProviderOptions = {
  chainId: number;
  userId?: string;
  onFailoverStateChange?: SolanaFailoverStateChangeCallback;
};

/**
 * Get an RPC provider manager for a specific EVM chain
 *
 * Resolves configuration from user preferences or chain defaults,
 * then creates (or retrieves cached) RpcProviderManager instance.
 *
 * @throws Error if chain is a Solana chain (use getSolanaProvider instead)
 */
export async function getRpcProvider(
  options: GetProviderOptions
): Promise<RpcProviderManager> {
  const { chainId, userId, onFailoverStateChange } = options;

  if (isSolanaChain(chainId)) {
    throw new Error(
      `Chain ${chainId} is a Solana chain. Use getSolanaProvider() instead.`
    );
  }

  const config = await resolveRpcConfig(chainId, userId);

  if (!config) {
    throw new Error(`Chain ${chainId} not found or not enabled`);
  }

  return createRpcProviderManager({
    primaryRpcUrl: config.primaryRpcUrl,
    fallbackRpcUrl: config.fallbackRpcUrl,
    chainName: config.chainName,
    metricsCollector: consoleMetricsCollector,
    onFailoverStateChange,
  });
}

/**
 * Get a Solana provider manager for a specific Solana chain
 *
 * Resolves configuration from user preferences or chain defaults,
 * then creates (or retrieves cached) SolanaProviderManager instance.
 *
 * @throws Error if chain is not a Solana chain (use getRpcProvider instead)
 */
export async function getSolanaProvider(
  options: GetSolanaProviderOptions
): Promise<SolanaProviderManager> {
  const { chainId, userId, onFailoverStateChange } = options;

  if (!isSolanaChain(chainId)) {
    throw new Error(
      `Chain ${chainId} is not a Solana chain. Use getRpcProvider() instead.`
    );
  }

  const config = await resolveRpcConfig(chainId, userId);

  if (!config) {
    throw new Error(`Solana chain ${chainId} not found or not enabled`);
  }

  return createSolanaProviderManager({
    primaryRpcUrl: config.primaryRpcUrl,
    fallbackRpcUrl: config.fallbackRpcUrl,
    chainName: config.chainName,
    metricsCollector: consoleSolanaMetricsCollector,
    onFailoverStateChange,
  });
}

/**
 * Get an RPC provider from explicit URLs (for testing or override scenarios)
 */
export function getRpcProviderFromUrls(
  primaryRpcUrl: string,
  fallbackRpcUrl?: string,
  chainName = "unknown"
): RpcProviderManager {
  return createRpcProviderManager({
    primaryRpcUrl,
    fallbackRpcUrl,
    chainName,
    metricsCollector: consoleMetricsCollector,
  });
}

/**
 * Get a Solana provider from explicit URLs (for testing or override scenarios)
 */
export function getSolanaProviderFromUrls(
  primaryRpcUrl: string,
  fallbackRpcUrl?: string,
  chainName = "solana"
): SolanaProviderManager {
  return createSolanaProviderManager({
    primaryRpcUrl,
    fallbackRpcUrl,
    chainName,
    metricsCollector: consoleSolanaMetricsCollector,
  });
}
