import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { normalizeAddressForStorage } from "@/keeperhub/lib/address-utils";
import { ERC20_ABI } from "@/lib/contracts";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";

/**
 * Validate Token API
 *
 * Validates that an address is a valid ERC20 token and fetches its metadata.
 *
 * Query params:
 * - address: The token contract address
 * - network: Network name (e.g., "eth-mainnet", "base")
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const network = searchParams.get("network");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 }
    );
  }

  if (!network) {
    return NextResponse.json(
      { error: "Missing network parameter" },
      { status: 400 }
    );
  }

  // Validate address format
  if (!ethers.isAddress(address)) {
    return NextResponse.json(
      { valid: false, error: "Invalid address format" },
      { status: 200 }
    );
  }

  try {
    // Get chain ID and RPC URL
    const chainId = getChainIdFromNetwork(network);
    const rpcConfig = await resolveRpcConfig(chainId);

    if (!rpcConfig) {
      return NextResponse.json(
        { valid: false, error: "Network not supported" },
        { status: 200 }
      );
    }

    // Create provider and contract
    const provider = new ethers.JsonRpcProvider(rpcConfig.primaryRpcUrl);
    const contract = new ethers.Contract(address, ERC20_ABI, provider);

    // Try to fetch ERC20 metadata - if this fails, it's not a valid ERC20
    const [symbol, name, decimals] = await Promise.all([
      contract.symbol() as Promise<string>,
      contract.name() as Promise<string>,
      contract.decimals() as Promise<bigint>,
    ]);

    return NextResponse.json({
      valid: true,
      token: {
        address: normalizeAddressForStorage(address),
        symbol,
        name,
        decimals: Number(decimals),
      },
    });
  } catch (error) {
    console.error("[Validate Token] Error:", error);
    return NextResponse.json(
      { valid: false, error: "Not a valid ERC20 token" },
      { status: 200 }
    );
  }
}
