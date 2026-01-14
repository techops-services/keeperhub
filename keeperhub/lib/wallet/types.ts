/**
 * Shared types for wallet functionality
 */

export type ChainData = {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  chainType: string;
  defaultPrimaryRpc: string;
  isTestnet: boolean;
  isEnabled: boolean;
};

export type ChainBalance = {
  chainId: number;
  name: string;
  symbol: string;
  balance: string;
  loading: boolean;
  isTestnet: boolean;
  error?: string;
};

export type TokenData = {
  id: string;
  chainId: number;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
};

export type TokenBalance = {
  tokenId: string;
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  loading: boolean;
  error?: string;
};

export type WalletData = {
  hasWallet: boolean;
  walletAddress?: string;
  walletId?: string;
  email?: string;
  createdAt?: string;
};
