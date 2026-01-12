/**
 * RPC URL configuration utilities
 *
 * RPC URL resolution priority:
 *   1. CHAIN_RPC_CONFIG JSON (for Helm/AWS Parameter Store)
 *   2. Individual env vars (CHAIN_ETH_MAINNET_PRIMARY_RPC, etc.)
 *   3. Public RPC defaults (no API keys required)
 *
 * JSON config format (CHAIN_RPC_CONFIG from AWS Parameter Store):
 *   {
 *     "eth-mainnet": {
 *       "chainId": 1,
 *       "symbol": "ETH",
 *       "primaryRpcUrl": "https://...",
 *       "fallbackRpcUrl": "https://...",
 *       "primaryWssUrl": "wss://...",
 *       "fallbackWssUrl": "wss://...",
 *       "isEnabled": true,
 *       "isTestnet": false
 *     }
 *   }
 */

/**
 * Public RPC defaults (no API keys required)
 * These are used as last resort when no config is provided
 */
export const PUBLIC_RPCS = {
  ETH_MAINNET: "https://eth.llamarpc.com",
  SEPOLIA: "https://ethereum-sepolia-rpc.publicnode.com",
  BASE_MAINNET: "https://mainnet.base.org",
  BASE_SEPOLIA: "https://sepolia.base.org",
  TEMPO_TESTNET: "https://rpc.testnet.tempo.xyz",
  TEMPO_MAINNET: "https://rpc.tempo.xyz",
  SOLANA_MAINNET: "https://api.mainnet-beta.solana.com",
  SOLANA_DEVNET: "https://api.devnet.solana.com",
} as const;

/**
 * Type for RPC configuration entry
 */
export type RpcConfigEntry = {
  chainId?: number;
  symbol?: string;
  primaryRpcUrl?: string;
  fallbackRpcUrl?: string;
  primaryWssUrl?: string;
  fallbackWssUrl?: string;
  isEnabled?: boolean;
  isTestnet?: boolean;
};

/**
 * Type for RPC configuration object
 */
export type RpcConfig = Record<string, RpcConfigEntry>;

/**
 * Options for getRpcUrl function
 */
export type GetRpcUrlOptions = {
  rpcConfig: RpcConfig;
  jsonKey: string;
  envValue: string | undefined;
  publicDefault: string;
  type: "primary" | "fallback";
};

/**
 * Parse JSON config from environment variable
 *
 * @param envValue - The CHAIN_RPC_CONFIG environment variable value
 * @returns Parsed RPC config object, or empty object on failure
 */
export function parseRpcConfig(envValue: string | undefined): RpcConfig {
  try {
    return JSON.parse(envValue || "{}");
  } catch {
    return {};
  }
}

/**
 * Get RPC URL with priority: JSON config → individual env var → public default
 *
 * @param options - Configuration options
 * @returns The resolved RPC URL
 */
export function getRpcUrl(options: GetRpcUrlOptions): string {
  const { rpcConfig, jsonKey, envValue, publicDefault, type } = options;
  const entry = rpcConfig[jsonKey];

  if (!entry) {
    return envValue || publicDefault;
  }

  if (type === "primary" && entry.primaryRpcUrl) {
    return entry.primaryRpcUrl;
  }
  if (type === "fallback" && entry.fallbackRpcUrl) {
    return entry.fallbackRpcUrl;
  }

  return envValue || publicDefault;
}

/**
 * Options for getWssUrl function
 */
export type GetWssUrlOptions = {
  rpcConfig: RpcConfig;
  jsonKey: string;
  type: "primary" | "fallback";
};

/**
 * Get WebSocket URL from JSON config (new schema only)
 *
 * @param options - Configuration options
 * @returns The resolved WSS URL, or undefined if not configured
 */
export function getWssUrl(options: GetWssUrlOptions): string | undefined {
  const { rpcConfig, jsonKey, type } = options;
  const entry = rpcConfig[jsonKey];

  if (!entry) {
    return;
  }

  if (type === "primary") {
    return entry.primaryWssUrl;
  }
  return entry.fallbackWssUrl;
}

/**
 * Get a config value from RPC config with fallback to default
 *
 * @param rpcConfig - The parsed RPC config object
 * @param jsonKey - The chain key (e.g., "eth-mainnet", "base-mainnet")
 * @param field - The field to retrieve (e.g., "symbol", "chainId", "isEnabled")
 * @param defaultValue - Default value if not found in config
 * @returns The config value or default
 */
export function getConfigValue<T>(
  rpcConfig: RpcConfig,
  jsonKey: string,
  field: keyof RpcConfigEntry,
  defaultValue: T
): T {
  const entry = rpcConfig[jsonKey];
  if (entry && field in entry && entry[field] !== undefined) {
    return entry[field] as T;
  }
  return defaultValue;
}

/**
 * Create a pre-configured getRpcUrl helper using process.env
 *
 * This is a convenience function for scripts that need to resolve RPC URLs
 * using the standard environment variable pattern.
 *
 * @param rpcConfig - Pre-parsed RPC config (from parseRpcConfig)
 * @returns A function that resolves RPC URLs for a given chain
 */
export function createRpcUrlResolver(rpcConfig: RpcConfig) {
  return function resolveRpcUrl(
    jsonKey: string,
    envKey: string,
    publicDefault: string,
    type: "primary" | "fallback"
  ): string {
    return getRpcUrl({
      rpcConfig,
      jsonKey,
      envValue: process.env[envKey],
      publicDefault,
      type,
    });
  };
}
