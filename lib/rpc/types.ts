/**
 * RPC Configuration Types
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  explorerUrl?: string;
  explorerApiUrl?: string;
  isTestnet: boolean;
}

export interface ResolvedRpcConfig {
  chainId: number;
  chainName: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  source: "user" | "default";
}

export const SUPPORTED_CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  BASE: 8453,
} as const;

export type SupportedChainId =
  (typeof SUPPORTED_CHAIN_IDS)[keyof typeof SUPPORTED_CHAIN_IDS];
