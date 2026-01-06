import { NextResponse } from "next/server";
import { getEnabledChains, getAllChains } from "@/lib/rpc/chain-service";

export type ChainResponse = {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  defaultPrimaryRpc: string;
  defaultFallbackRpc: string | null;
  explorerUrl: string | null;
  explorerApiUrl: string | null;
  isTestnet: boolean;
  isEnabled: boolean;
};

export type GetChainsResponse = ChainResponse[];

/**
 * GET /api/chains
 * List all available chains
 *
 * Query params:
 * - includeDisabled: "true" to include disabled chains (default: false)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get("includeDisabled") === "true";

    const chains = includeDisabled
      ? await getAllChains()
      : await getEnabledChains();

    const response: GetChainsResponse = chains.map((chain) => ({
      id: chain.id,
      chainId: chain.chainId,
      name: chain.name,
      symbol: chain.symbol,
      defaultPrimaryRpc: chain.defaultPrimaryRpc,
      defaultFallbackRpc: chain.defaultFallbackRpc,
      explorerUrl: chain.explorerUrl,
      explorerApiUrl: chain.explorerApiUrl,
      isTestnet: chain.isTestnet ?? false,
      isEnabled: chain.isEnabled ?? true,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get chains:", error);
    return NextResponse.json(
      {
        error: "Failed to get chains",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
