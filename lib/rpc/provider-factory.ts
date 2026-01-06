/**
 * RPC Provider Factory
 *
 * Creates RpcProviderManager instances with proper configuration
 * resolved from user preferences or chain defaults.
 */

import {
  consoleMetricsCollector,
  createRpcProviderManager,
  type FailoverStateChangeCallback,
  type RpcProviderManager,
} from "@/lib/rpc-provider";
import { resolveRpcConfig } from "./config-service";

export type GetProviderOptions = {
  chainId: number;
  userId?: string;
  onFailoverStateChange?: FailoverStateChangeCallback;
};

/**
 * Get an RPC provider manager for a specific chain
 *
 * Resolves configuration from user preferences or chain defaults,
 * then creates (or retrieves cached) RpcProviderManager instance.
 */
export async function getRpcProvider(
  options: GetProviderOptions
): Promise<RpcProviderManager> {
  const { chainId, userId, onFailoverStateChange } = options;

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
