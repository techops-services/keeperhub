/**
 * RPC Configuration Types
 */

export type ChainConfig = {
  chainId: number;
  name: string;
  symbol: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  explorerUrl?: string;
  explorerApiUrl?: string;
  isTestnet: boolean;
};

export type ResolvedRpcConfig = {
  chainId: number;
  chainName: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  source: "user" | "default";
};

export const SUPPORTED_CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11_155_111,
  BASE: 8453,
} as const;

export type SupportedChainId =
  (typeof SUPPORTED_CHAIN_IDS)[keyof typeof SUPPORTED_CHAIN_IDS];
