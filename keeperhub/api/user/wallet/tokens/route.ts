import { and, eq } from "drizzle-orm";
import { ethers } from "ethers";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { organizationHasWallet } from "@/keeperhub/lib/para/wallet-helpers";
import { auth } from "@/lib/auth";
import { ERC20_ABI } from "@/lib/contracts";
import { db } from "@/lib/db";
import { chains, organizationTokens } from "@/lib/db/schema";

/**
 * GET /api/user/wallet/tokens
 *
 * Get all tracked tokens for the organization
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization selected" },
        { status: 400 }
      );
    }

    const tokens = await db
      .select()
      .from(organizationTokens)
      .where(eq(organizationTokens.organizationId, activeOrgId));

    return NextResponse.json({ tokens });
  } catch (error) {
    return apiError(error, "Failed to fetch tokens");
  }
}

/**
 * POST /api/user/wallet/tokens
 *
 * Add a new token to track for the organization.
 * Fetches token metadata from the contract.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization selected" },
        { status: 400 }
      );
    }

    // Check if user has admin role
    const activeMember = await auth.api.getActiveMember({
      headers: await headers(),
    });

    const isAdminOrOwner =
      activeMember?.role === "admin" || activeMember?.role === "owner";
    if (!isAdminOrOwner) {
      return NextResponse.json(
        { error: "Only organization admins can manage tokens" },
        { status: 403 }
      );
    }

    // Check if organization has a wallet
    const hasWallet = await organizationHasWallet(activeOrgId);
    if (!hasWallet) {
      return NextResponse.json(
        { error: "Organization must have a wallet to track tokens" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { chainId, tokenAddress } = body;

    if (!chainId || typeof chainId !== "number") {
      return NextResponse.json(
        { error: "chainId is required and must be a number" },
        { status: 400 }
      );
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { error: "Token address is required" },
        { status: 400 }
      );
    }

    if (!ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { error: "Invalid token address format" },
        { status: 400 }
      );
    }

    // Check if chain exists and is enabled
    const chain = await db
      .select()
      .from(chains)
      .where(and(eq(chains.chainId, chainId), eq(chains.isEnabled, true)))
      .limit(1);

    if (chain.length === 0) {
      return NextResponse.json(
        { error: "Chain not found or not enabled" },
        { status: 400 }
      );
    }

    // Check if token is already tracked
    const existing = await db
      .select()
      .from(organizationTokens)
      .where(
        and(
          eq(organizationTokens.organizationId, activeOrgId),
          eq(organizationTokens.chainId, chainId),
          eq(organizationTokens.tokenAddress, tokenAddress.toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Token is already being tracked" },
        { status: 400 }
      );
    }

    // Fetch token metadata from the contract
    const provider = new ethers.JsonRpcProvider(chain[0].defaultPrimaryRpc);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    let symbol: string;
    let name: string;
    let decimals: number;

    try {
      [symbol, name, decimals] = await Promise.all([
        contract.symbol() as Promise<string>,
        contract.name() as Promise<string>,
        contract.decimals().then((d: bigint) => Number(d)),
      ]);
    } catch (error) {
      console.error("[Tokens] Failed to fetch token metadata:", error);
      return NextResponse.json(
        { error: "Failed to fetch token metadata. Is this a valid ERC20?" },
        { status: 400 }
      );
    }

    // Insert the token
    const [newToken] = await db
      .insert(organizationTokens)
      .values({
        organizationId: activeOrgId,
        chainId,
        tokenAddress: tokenAddress.toLowerCase(),
        symbol,
        name,
        decimals,
      })
      .returning();

    console.log(
      `[Tokens] Added token ${symbol} (${tokenAddress}) for org ${activeOrgId} on chain ${chainId}`
    );

    return NextResponse.json({ token: newToken });
  } catch (error) {
    return apiError(error, "Failed to add token");
  }
}

/**
 * DELETE /api/user/wallet/tokens
 *
 * Remove a tracked token. Expects { tokenId } in the body.
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization selected" },
        { status: 400 }
      );
    }

    // Check if user has admin role
    const activeMember = await auth.api.getActiveMember({
      headers: await headers(),
    });

    const isAdminOrOwner =
      activeMember?.role === "admin" || activeMember?.role === "owner";
    if (!isAdminOrOwner) {
      return NextResponse.json(
        { error: "Only organization admins can manage tokens" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tokenId } = body;

    if (!tokenId || typeof tokenId !== "string") {
      return NextResponse.json(
        { error: "tokenId is required" },
        { status: 400 }
      );
    }

    // Delete the token (only if it belongs to this organization)
    const deleted = await db
      .delete(organizationTokens)
      .where(
        and(
          eq(organizationTokens.id, tokenId),
          eq(organizationTokens.organizationId, activeOrgId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Token not found or not owned by this organization" },
        { status: 404 }
      );
    }

    console.log(
      `[Tokens] Removed token ${deleted[0].symbol} for org ${activeOrgId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Failed to remove token");
  }
}
