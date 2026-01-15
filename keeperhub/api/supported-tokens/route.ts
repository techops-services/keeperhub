import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chains, supportedTokens } from "@/lib/db/schema";
import { getChainIdFromNetwork } from "@/lib/rpc";

/**
 * GET /api/supported-tokens
 *
 * Returns supported tokens.
 * Query params:
 * - network: Network name (e.g., "eth-mainnet", "sepolia") - returns tokens for specific chain
 * - chainId: Chain ID (alternative to network name) - returns tokens for specific chain
 * - (no params): Returns ALL supported tokens across all enabled chains
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

    // Fetch supported tokens for this chain
    const tokens = await db
      .select()
      .from(supportedTokens)
      .where(eq(supportedTokens.chainId, chainId))
      .orderBy(supportedTokens.sortOrder);

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
