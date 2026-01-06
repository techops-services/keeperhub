import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  setUserRpcPreference,
  deleteUserRpcPreference,
} from "@/lib/rpc/config-service";
import { getChainByChainId } from "@/lib/rpc/chain-service";

export type SetRpcPreferenceRequest = {
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
};

export type SetRpcPreferenceResponse = {
  id: string;
  chainId: number;
  primaryRpcUrl: string;
  fallbackRpcUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * PUT /api/user/rpc-preferences/:chainId
 * Set or update user's RPC preference for a chain
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chainId: chainIdStr } = await params;
    const chainId = parseInt(chainIdStr, 10);

    if (isNaN(chainId)) {
      return NextResponse.json(
        { error: "Invalid chain ID" },
        { status: 400 }
      );
    }

    // Verify chain exists
    const chain = await getChainByChainId(chainId);
    if (!chain) {
      return NextResponse.json(
        { error: `Chain ${chainId} not found` },
        { status: 404 }
      );
    }

    const body: SetRpcPreferenceRequest = await request.json();

    if (!body.primaryRpcUrl) {
      return NextResponse.json(
        { error: "primaryRpcUrl is required" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(body.primaryRpcUrl);
      if (body.fallbackRpcUrl) {
        new URL(body.fallbackRpcUrl);
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid RPC URL format" },
        { status: 400 }
      );
    }

    const preference = await setUserRpcPreference(
      session.user.id,
      chainId,
      body.primaryRpcUrl,
      body.fallbackRpcUrl
    );

    const response: SetRpcPreferenceResponse = {
      id: preference.id,
      chainId: preference.chainId,
      primaryRpcUrl: preference.primaryRpcUrl,
      fallbackRpcUrl: preference.fallbackRpcUrl,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to set RPC preference:", error);
    return NextResponse.json(
      {
        error: "Failed to set RPC preference",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/rpc-preferences/:chainId
 * Remove user's custom RPC preference for a chain (reverts to defaults)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chainId: chainIdStr } = await params;
    const chainId = parseInt(chainIdStr, 10);

    if (isNaN(chainId)) {
      return NextResponse.json(
        { error: "Invalid chain ID" },
        { status: 400 }
      );
    }

    const deleted = await deleteUserRpcPreference(session.user.id, chainId);

    if (!deleted) {
      return NextResponse.json(
        { error: "RPC preference not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete RPC preference:", error);
    return NextResponse.json(
      {
        error: "Failed to delete RPC preference",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
