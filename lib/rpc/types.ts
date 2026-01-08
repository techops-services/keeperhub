/**
 * RPC Configuration Types
 */

export type ChainConfig = {
  chainId: number;
  name: string;
  symbol: string;
  chainType: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  primaryWssUrl?: string;
  fallbackWssUrl?: string;
  isTestnet: boolean;
};

export type ExplorerConfigType = {
  chainId: number;
  chainType: string;
  explorerUrl?: string;
  explorerApiType?: string;
  explorerApiUrl?: string;
  explorerTxPath?: string;
  explorerAddressPath?: string;
  explorerContractPath?: string;
};

export type ResolvedRpcConfig = {
  chainId: number;
  chainName: string;
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  primaryWssUrl?: string;
  fallbackWssUrl?: string;
  source: "user" | "default";
};

export const SUPPORTED_CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11_155_111,
  BASE: 8453,
} as const;

export type SupportedChainId =
  (typeof SUPPORTED_CHAIN_IDS)[keyof typeof SUPPORTED_CHAIN_IDS];
