import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChainByChainId } from "@/lib/rpc/chain-service";
import {
  deleteUserRpcPreference,
  resolveRpcConfig,
  setUserRpcPreference,
} from "@/lib/rpc/config-service";

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

export type GetRpcConfigResponse = {
  chainId: number;
  chainName: string;
  primaryRpcUrl: string;
  fallbackRpcUrl: string | null;
  primaryWssUrl: string | null;
  fallbackWssUrl: string | null;
  source: "user" | "default";
};

/**
 * GET /api/user/rpc-preferences/:chainId
 * Get the resolved RPC config for a specific chain (user preference or default)
 */
export async function GET(
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
    const chainId = Number.parseInt(chainIdStr, 10);

    if (Number.isNaN(chainId)) {
      return NextResponse.json({ error: "Invalid chain ID" }, { status: 400 });
    }

    const config = await resolveRpcConfig(chainId, session.user.id);

    if (!config) {
      return NextResponse.json(
        { error: `Chain ${chainId} not found or disabled` },
        { status: 404 }
      );
    }

    const response: GetRpcConfigResponse = {
      chainId: config.chainId,
      chainName: config.chainName,
      primaryRpcUrl: config.primaryRpcUrl,
      fallbackRpcUrl: config.fallbackRpcUrl ?? null,
      primaryWssUrl: config.primaryWssUrl ?? null,
      fallbackWssUrl: config.fallbackWssUrl ?? null,
      source: config.source,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get RPC config:", error);
    return NextResponse.json(
      {
        error: "Failed to get RPC config",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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
    const chainId = Number.parseInt(chainIdStr, 10);

    if (Number.isNaN(chainId)) {
      return NextResponse.json({ error: "Invalid chain ID" }, { status: 400 });
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
    const chainId = Number.parseInt(chainIdStr, 10);

    if (Number.isNaN(chainId)) {
      return NextResponse.json({ error: "Invalid chain ID" }, { status: 400 });
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
