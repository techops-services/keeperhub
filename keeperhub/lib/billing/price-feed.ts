// start custom keeperhub code //
/**
 * ETH Price Feed Service
 *
 * Provides ETH/USD price data for credit cost calculations.
 * Uses CoinGecko API with caching to minimize API calls.
 */

// Cache for ETH price to avoid excessive API calls
let cachedPrice: { value: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Get current ETH price in USD
 * Uses CoinGecko API with 1-minute caching
 */
export async function getEthPriceUsd(): Promise<number> {
  // Return cached price if still valid
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL_MS) {
    return cachedPrice.value;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 }, // Next.js cache for 1 minute
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = (await response.json()) as { ethereum?: { usd?: number } };
    const price = data.ethereum?.usd;

    if (typeof price !== "number" || price <= 0) {
      throw new Error("Invalid price data from CoinGecko");
    }

    // Update cache
    cachedPrice = { value: price, timestamp: Date.now() };

    return price;
  } catch (error) {
    console.error("[PriceFeed] Failed to fetch ETH price:", error);

    // Return cached price if available (even if stale)
    if (cachedPrice) {
      console.warn("[PriceFeed] Using stale cached price");
      return cachedPrice.value;
    }

    // Fallback to a reasonable default if all else fails
    console.warn("[PriceFeed] Using fallback price of $3000");
    return 3000;
  }
}

/**
 * Convert gas cost to credits
 *
 * @param gasLimit - Estimated gas limit
 * @param gasPriceWei - Gas price in wei
 * @param ethPriceUsd - Current ETH price in USD
 * @returns Number of credits (1 credit = $0.01)
 */
export function gasToCredits(
  gasLimit: bigint,
  gasPriceWei: bigint,
  ethPriceUsd: number
): number {
  // Gas cost in wei = gasLimit * gasPrice
  const gasCostWei = gasLimit * gasPriceWei;

  // Convert wei to ETH (1 ETH = 10^18 wei)
  const gasCostEth = Number(gasCostWei) / 1e18;

  // Convert ETH to USD
  const gasCostUsd = gasCostEth * ethPriceUsd;

  // Convert USD to credits (1 credit = $0.01)
  // Round up to ensure we don't undercharge
  return Math.ceil(gasCostUsd * 100);
}

/**
 * Format credits as USD string
 */
export function creditsToUsd(credits: number): string {
  const usd = credits / 100;
  return `$${usd.toFixed(2)}`;
}

// Reset cache (for testing)
export function resetPriceCache(): void {
  cachedPrice = null;
}
// end keeperhub code //
