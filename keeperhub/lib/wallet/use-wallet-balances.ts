"use client";

import { useCallback, useState } from "react";
import {
  fetchAllNativeBalances,
  fetchAllTokenBalances,
} from "./fetch-balances";
import type { ChainBalance, ChainData, TokenBalance, TokenData } from "./types";

type UseWalletBalancesReturn = {
  balances: ChainBalance[];
  tokenBalances: TokenBalance[];
  loading: boolean;
  fetchBalances: (
    address: string,
    chains: ChainData[],
    tokens: TokenData[]
  ) => Promise<void>;
  refreshBalances: (
    address: string,
    chains: ChainData[],
    tokens: TokenData[]
  ) => Promise<void>;
};

/**
 * Hook for managing wallet balances (native + ERC20 tokens)
 */
export function useWalletBalances(): UseWalletBalancesReturn {
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(
    async (address: string, chains: ChainData[], tokens: TokenData[]) => {
      if (chains.length === 0) {
        return;
      }

      setLoading(true);

      // Set loading state for all balances
      setBalances(
        chains.map((chain) => ({
          chainId: chain.chainId,
          name: chain.name,
          symbol: chain.symbol,
          balance: "0",
          loading: true,
          isTestnet: chain.isTestnet,
          explorerUrl: chain.explorerUrl
            ? `${chain.explorerUrl}${(chain.explorerAddressPath || "/address/{address}").replace("{address}", address)}`
            : null,
        }))
      );

      if (tokens.length > 0) {
        setTokenBalances(
          tokens.map((token) => ({
            tokenId: token.id,
            chainId: token.chainId,
            tokenAddress: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            balance: "0",
            loading: true,
          }))
        );
      }

      // Fetch all balances in parallel
      const [nativeResults, tokenResults] = await Promise.all([
        fetchAllNativeBalances(address, chains),
        tokens.length > 0
          ? fetchAllTokenBalances(address, tokens, chains)
          : Promise.resolve([]),
      ]);

      setBalances(nativeResults);
      setTokenBalances(tokenResults);
      setLoading(false);
    },
    []
  );

  const refreshBalances = useCallback(
    async (address: string, chains: ChainData[], tokens: TokenData[]) => {
      // Same as fetchBalances but used for refresh action
      await fetchBalances(address, chains, tokens);
    },
    [fetchBalances]
  );

  return {
    balances,
    tokenBalances,
    loading,
    fetchBalances,
    refreshBalances,
  };
}
