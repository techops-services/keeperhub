/**
 * Utility functions for fetching wallet balances via RPC
 */

import type {
  ChainBalance,
  ChainData,
  SupportedToken,
  SupportedTokenBalance,
  TokenBalance,
  TokenData,
} from "./types";

/**
 * Maximum balance threshold (1 trillion tokens) - balances above this are considered
 * testnet mock balances and treated as zero (not meaningful)
 */
const MAX_DISPLAY_BALANCE = BigInt("1000000000000"); // 1 trillion
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_FIVE = BigInt(5);
const BIGINT_TEN = BigInt(10);

/**
 * Format a BigInt wei value to a decimal string with proper precision.
 * Handles arbitrarily large values without JavaScript Number precision loss.
 *
 * @param weiValue - The balance in wei as BigInt
 * @param decimals - Number of decimals (18 for ETH, varies for tokens)
 * @param displayDecimals - Number of decimal places to show in output (default 6)
 * @returns Formatted balance string, or "0.000000" for testnet mock balances
 */
export function formatWeiToBalance(
  weiValue: bigint,
  decimals: number,
  displayDecimals = 6
): string {
  // Handle zero case
  if (weiValue === BIGINT_ZERO) {
    return `0.${"0".repeat(displayDecimals)}`;
  }

  const divisor = BIGINT_TEN ** BigInt(decimals);
  const wholePart = weiValue / divisor;

  // Testnet mock balances (unrealistically large values) are not meaningful - show as zero
  if (wholePart > MAX_DISPLAY_BALANCE) {
    return `0.${"0".repeat(displayDecimals)}`;
  }

  // Calculate fractional part with extra precision for rounding
  const remainder = weiValue % divisor;
  const scaleFactor = BIGINT_TEN ** BigInt(displayDecimals + 1); // +1 for rounding digit
  const scaledFraction = (remainder * scaleFactor) / divisor;

  // Round the last digit
  const roundedFraction = (scaledFraction + BIGINT_FIVE) / BIGINT_TEN;

  // Handle carry from rounding
  const maxFraction = BIGINT_TEN ** BigInt(displayDecimals);
  let finalWhole = wholePart;
  let finalFraction = roundedFraction;

  if (finalFraction >= maxFraction) {
    finalWhole += BIGINT_ONE;
    finalFraction = BIGINT_ZERO;
  }

  // Format the fractional part with leading zeros
  const fractionStr = finalFraction.toString().padStart(displayDecimals, "0");

  return `${finalWhole}.${fractionStr}`;
}

/**
 * Build explorer address URL for a chain
 */
function buildExplorerAddressUrl(
  chain: ChainData,
  address: string
): string | null {
  if (!chain.explorerUrl) {
    return null;
  }
  const path = chain.explorerAddressPath || "/address/{address}";
  return `${chain.explorerUrl}${path.replace("{address}", address)}`;
}

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

    return {
      chainId: chain.chainId,
      name: chain.name,
      symbol: chain.symbol,
      balance: formatWeiToBalance(balanceWei, 18),
      loading: false,
      isTestnet: chain.isTestnet,
      explorerUrl: buildExplorerAddressUrl(chain, address),
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
      explorerUrl: buildExplorerAddressUrl(chain, address),
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

    return {
      tokenId: token.id,
      chainId: token.chainId,
      symbol: token.symbol,
      name: token.name,
      balance: formatWeiToBalance(balanceWei, token.decimals),
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

/**
 * Fetch balance for a single supported token with retry logic
 */
export function fetchSupportedTokenBalance(
  address: string,
  token: SupportedToken,
  chain: ChainData,
  retries = 3
): Promise<SupportedTokenBalance> {
  const makeRequest = async (
    attempt: number
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Retry logic with exponential backoff requires this complexity
  ): Promise<SupportedTokenBalance> => {
    try {
      // ERC20 balanceOf function signature
      const balanceOfSelector = "0x70a08231";

      // Encode the balanceOf call data
      const addressWithoutPrefix = address.startsWith("0x")
        ? address.slice(2)
        : address;
      const paddedAddress = addressWithoutPrefix
        .toLowerCase()
        .padStart(64, "0");
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

      // Handle rate limiting with retry
      if (response.status === 429 && attempt < retries) {
        const backoffMs = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return makeRequest(attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message || "RPC error");
      }

      if (!result.result || result.result === "0x") {
        return {
          chainId: token.chainId,
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          name: token.name,
          logoUrl: token.logoUrl,
          balance: "0.000000",
          loading: false,
        };
      }

      const balanceWei = BigInt(result.result);

      return {
        chainId: token.chainId,
        tokenAddress: token.tokenAddress,
        symbol: token.symbol,
        name: token.name,
        logoUrl: token.logoUrl,
        balance: formatWeiToBalance(balanceWei, token.decimals),
        loading: false,
      };
    } catch (error) {
      // Retry on network errors
      if (
        attempt < retries &&
        error instanceof Error &&
        !error.message.includes("HTTP 4")
      ) {
        const backoffMs = Math.min(500 * 2 ** attempt, 3000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return makeRequest(attempt + 1);
      }

      console.error(`Failed to fetch balance for ${token.symbol}:`, error);
      return {
        chainId: token.chainId,
        tokenAddress: token.tokenAddress,
        symbol: token.symbol,
        name: token.name,
        logoUrl: token.logoUrl,
        balance: "0",
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch",
      };
    }
  };

  return makeRequest(0);
}

/**
 * Helper to add delay between requests
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process items in batches with delay between batches to avoid rate limits
 */
async function processBatched<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize = 3,
  delayMs = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Add delay between batches (but not after the last batch)
    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * Fetch balances for all supported tokens (with rate limiting)
 */
export async function fetchAllSupportedTokenBalances(
  address: string,
  tokens: SupportedToken[],
  chains: ChainData[]
): Promise<SupportedTokenBalance[]> {
  // Group tokens by chain to minimize RPC switches
  const tokensByChain = new Map<number, SupportedToken[]>();
  for (const token of tokens) {
    const existing = tokensByChain.get(token.chainId) || [];
    existing.push(token);
    tokensByChain.set(token.chainId, existing);
  }

  // Process each chain's tokens
  const allResults: SupportedTokenBalance[] = [];

  for (const [chainId, chainTokens] of tokensByChain) {
    const chain = chains.find((c) => c.chainId === chainId);

    if (!chain) {
      // Add error results for tokens on missing chains
      for (const token of chainTokens) {
        allResults.push({
          chainId: token.chainId,
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          name: token.name,
          logoUrl: token.logoUrl,
          balance: "0",
          loading: false,
          error: `Chain ${token.chainId} not found`,
        });
      }
      continue;
    }

    // Process tokens for this chain sequentially to avoid rate limits
    const chainResults = await processBatched(
      chainTokens,
      (token) => fetchSupportedTokenBalance(address, token, chain),
      1, // 1 request at a time (sequential)
      200 // 200ms delay between requests
    );

    allResults.push(...chainResults);
  }

  return allResults;
}
