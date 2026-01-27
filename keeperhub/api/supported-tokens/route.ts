import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chains, supportedTokens } from "@/lib/db/schema";
import { getChainIdFromNetwork } from "@/lib/rpc";

// Mainnet chain ID - used as the "master list" of supported tokens
const MAINNET_CHAIN_ID = 1;

// TEMPO testnet chain IDs - excluded from master list logic (have their own tokens)
const TEMPO_CHAIN_IDS = [42_429];

/**
 * GET /api/supported-tokens
 *
 * Returns supported tokens.
 * Query params:
 * - network: Network name (e.g., "eth-mainnet", "sepolia") - returns tokens for specific chain
 * - chainId: Chain ID (alternative to network name) - returns tokens for specific chain
 * - (no params): Returns ALL supported tokens across all enabled chains
 *
 * For non-TEMPO chains, returns all mainnet tokens as a "master list" with availability
 * info for the requested chain. This ensures users see consistent token options across
 * chains, with clear indication when a token isn't available on their selected chain.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get("network");
    const chainIdParam = searchParams.get("chainId");

    // If no parameters provided, return ALL supported tokens
    if (!(network || chainIdParam)) {
      const tokens = await db
        .select()
        .from(supportedTokens)
        .orderBy(supportedTokens.chainId, supportedTokens.sortOrder);

      return NextResponse.json({ tokens });
    }

    // Otherwise, filter by specific chain
    let chainId: number;

    if (chainIdParam) {
      chainId = Number.parseInt(chainIdParam, 10);
      if (Number.isNaN(chainId)) {
        return NextResponse.json(
          { error: "Invalid chainId parameter" },
          { status: 400 }
        );
      }
    } else if (network) {
      try {
        chainId = getChainIdFromNetwork(network);
      } catch {
        return NextResponse.json(
          { error: `Unknown network: ${network}` },
          { status: 400 }
        );
      }
    } else {
      // This shouldn't be reached due to early return above
      return NextResponse.json(
        { error: "Either network or chainId parameter is required" },
        { status: 400 }
      );
    }

    // Verify chain exists and is enabled
    const chain = await db
      .select()
      .from(chains)
      .where(eq(chains.chainId, chainId))
      .limit(1);

    if (chain.length === 0) {
      return NextResponse.json(
        { error: `Chain ${chainId} not found` },
        { status: 404 }
      );
    }

    if (!chain[0].isEnabled) {
      return NextResponse.json(
        { error: `Chain ${chainId} is not enabled` },
        { status: 400 }
      );
    }

    // For TEMPO chains, just return their own tokens (no master list logic)
    if (TEMPO_CHAIN_IDS.includes(chainId)) {
      const tokens = await db
        .select()
        .from(supportedTokens)
        .where(eq(supportedTokens.chainId, chainId))
        .orderBy(supportedTokens.sortOrder);

      return NextResponse.json({
        chainId,
        chainName: chain[0].name,
        tokens: tokens.map((t) => ({ ...t, available: true })),
      });
    }

    // For non-TEMPO chains, use mainnet tokens as the master list
    // Fetch both mainnet tokens and tokens for the requested chain
    const [mainnetTokens, chainTokens] = await Promise.all([
      db
        .select()
        .from(supportedTokens)
        .where(eq(supportedTokens.chainId, MAINNET_CHAIN_ID))
        .orderBy(supportedTokens.sortOrder),
      chainId !== MAINNET_CHAIN_ID
        ? db
            .select()
            .from(supportedTokens)
            .where(eq(supportedTokens.chainId, chainId))
            .orderBy(supportedTokens.sortOrder)
        : Promise.resolve([]),
    ]);

    // If requesting mainnet, just return mainnet tokens (all available)
    if (chainId === MAINNET_CHAIN_ID) {
      return NextResponse.json({
        chainId,
        chainName: chain[0].name,
        tokens: mainnetTokens.map((t) => ({ ...t, available: true })),
      });
    }

    // Build a map of chain tokens by symbol for quick lookup
    const chainTokensBySymbol = new Map(chainTokens.map((t) => [t.symbol, t]));

    // Return mainnet tokens as master list with availability for requested chain
    const tokens = mainnetTokens.map((mainnetToken) => {
      const chainToken = chainTokensBySymbol.get(mainnetToken.symbol);

      if (chainToken) {
        // Token is available on this chain - return chain-specific data
        return {
          ...chainToken,
          available: true,
        };
      }

      // Token not available on this chain - return mainnet data with available: false
      return {
        ...mainnetToken,
        available: false,
      };
    });

    return NextResponse.json({
      chainId,
      chainName: chain[0].name,
      tokens,
    });
  } catch (error) {
    console.error("[SupportedTokens] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch supported tokens" },
      { status: 500 }
    );
  }
}
