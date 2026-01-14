/**
 * Utility functions for fetching wallet balances via RPC
 */

import type { ChainBalance, ChainData, TokenBalance, TokenData } from "./types";

/**
 * Fetch native token balance for a single chain
 */
export async function fetchNativeBalance(
  address: string,
  chain: ChainData
): Promise<ChainBalance> {
  try {
    const response = await fetch(chain.defaultPrimaryRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }

    const balanceWei = BigInt(result.result);
    const balanceEth = Number(balanceWei) / 1e18;

    return {
      chainId: chain.chainId,
      name: chain.name,
      symbol: chain.symbol,
      balance: balanceEth.toFixed(6),
      loading: false,
      isTestnet: chain.isTestnet,
    };
  } catch (error) {
    console.error(`Failed to fetch balance for ${chain.name}:`, error);
    return {
      chainId: chain.chainId,
      name: chain.name,
      symbol: chain.symbol,
      balance: "0",
      loading: false,
      isTestnet: chain.isTestnet,
      error: error instanceof Error ? error.message : "Failed to fetch",
    };
  }
}

/**
 * Fetch ERC20 token balance for a single token
 */
export async function fetchTokenBalance(
  address: string,
  token: TokenData,
  chain: ChainData
): Promise<TokenBalance> {
  try {
    // ERC20 balanceOf function signature
    const balanceOfSelector = "0x70a08231";

    // Encode the balanceOf call data
    const addressWithoutPrefix = address.startsWith("0x")
      ? address.slice(2)
      : address;
    const paddedAddress = addressWithoutPrefix.toLowerCase().padStart(64, "0");
    const callData = `${balanceOfSelector}${paddedAddress}`;

    const response = await fetch(chain.defaultPrimaryRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: token.tokenAddress, data: callData }, "latest"],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || "RPC error");
    }

    if (!result.result || result.result === "0x") {
      return {
        tokenId: token.id,
        chainId: token.chainId,
        symbol: token.symbol,
        name: token.name,
        balance: "0.000000",
        loading: false,
      };
    }

    const balanceWei = BigInt(result.result);
    const balance = Number(balanceWei) / 10 ** token.decimals;

    return {
      tokenId: token.id,
      chainId: token.chainId,
      symbol: token.symbol,
      name: token.name,
      balance: balance.toFixed(6),
      loading: false,
    };
  } catch (error) {
    console.error(`Failed to fetch balance for ${token.symbol}:`, error);
    return {
      tokenId: token.id,
      chainId: token.chainId,
      symbol: token.symbol,
      name: token.name,
      balance: "0",
      loading: false,
      error: error instanceof Error ? error.message : "Failed to fetch",
    };
  }
}

/**
 * Fetch native balances for all chains
 */
export function fetchAllNativeBalances(
  address: string,
  chains: ChainData[]
): Promise<ChainBalance[]> {
  const promises = chains.map((chain) => fetchNativeBalance(address, chain));
  return Promise.all(promises);
}

/**
 * Fetch token balances for all tokens
 */
export function fetchAllTokenBalances(
  address: string,
  tokens: TokenData[],
  chains: ChainData[]
): Promise<TokenBalance[]> {
  const promises = tokens.map((token) => {
    const chain = chains.find((c) => c.chainId === token.chainId);
    if (!chain) {
      return Promise.resolve({
        tokenId: token.id,
        chainId: token.chainId,
        symbol: token.symbol,
        name: token.name,
        balance: "0",
        loading: false,
        error: `Chain ${token.chainId} not found`,
      });
    }
    return fetchTokenBalance(address, token, chain);
  });
  return Promise.all(promises);
}
