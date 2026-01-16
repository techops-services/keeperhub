import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { explorerConfigs } from "@/lib/db/schema";
import { fetchEtherscanSourceCode } from "@/lib/explorer/etherscan";
import { getChainIdFromNetwork } from "@/lib/rpc";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/**
 * Get explorer API config from database based on network/chainId
 * Supports both numeric chain IDs and legacy network names
 */
async function getExplorerApiConfig(network: string): Promise<{
  baseUrl: string;
  chainId: number;
  explorerApiType: string | null;
}> {
  // Parse network - supports numeric strings, numbers, and legacy names
  const chainId = getChainIdFromNetwork(network);

  // Get config from explorer_configs table
  const explorerResults = await db
    .select()
    .from(explorerConfigs)
    .where(eq(explorerConfigs.chainId, chainId))
    .limit(1);

  const explorer = explorerResults[0];

  if (explorer?.explorerApiUrl) {
    return {
      baseUrl: explorer.explorerApiUrl,
      chainId: explorer.chainId,
      explorerApiType: explorer.explorerApiType || null,
    };
  }

  throw new Error(
    `No explorer API configured for chain ${chainId}. Please contact support.`
  );
}

/**
 * Parse Etherscan error message into user-friendly message
 */
function parseEtherscanError(
  data: { status: string; message: string; result: string },
  contractAddress: string,
  network: string
): string {
  const errorMessage =
    data.result || data.message || "Failed to fetch ABI from Etherscan";
  const lowerMessage = errorMessage.toLowerCase();

  // Log the full response for debugging
  console.error("[Etherscan] API error response:", {
    status: data.status,
    message: data.message,
    result: data.result,
    contractAddress,
    network,
  });

  // Provide user-friendly error messages for common cases
  if (
    lowerMessage.includes("not verified") ||
    lowerMessage.includes("source code not verified")
  ) {
    return "Contract source code not verified on Etherscan. Please provide ABI manually.";
  }

  if (
    lowerMessage.includes("invalid api key") ||
    lowerMessage.includes("api key")
  ) {
    return "Etherscan API key is invalid or not configured. Please contact support.";
  }

  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("max rate limit")
  ) {
    return "Etherscan API rate limit exceeded. Please try again in a few moments.";
  }

  // Handle deprecated V1 endpoint error
  if (
    lowerMessage.includes("deprecated") ||
    lowerMessage.includes("v1 endpoint") ||
    lowerMessage.includes("v2-migration")
  ) {
    return "Etherscan API endpoint needs to be updated. Please contact support.";
  }

  // For "NOTOK" generic errors, provide a more helpful message
  if (errorMessage === "NOTOK" || data.message === "NOTOK") {
    return "Unable to fetch ABI from Etherscan. The contract may not be verified, or there may be an API issue. Please try providing the ABI manually.";
  }

  // For other errors, use the result message if available
  return errorMessage;
}

/**
 * Fetch ABI from Etherscan API using getabi action
 */
async function fetchAbiFromAddress(
  baseUrl: string,
  chainId: number,
  address: string
): Promise<string> {
  const url = new URL(baseUrl);
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getabi");
  url.searchParams.set("address", address);
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  const requestUrl = url.toString();
  console.log(
    "[Etherscan] Fetching ABI from:",
    requestUrl.replace(ETHERSCAN_API_KEY, "***")
  );

  const response = await fetch(requestUrl);

  if (!response.ok) {
    console.error("[Etherscan] HTTP error response:", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Etherscan API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    status: string;
    message: string;
    result: string;
  };

  if (data.status === "0") {
    const errorMessage = parseEtherscanError(data, address, "");
    throw new Error(errorMessage);
  }

  if (!data.result || data.result === "Contract source code not verified") {
    throw new Error(
      "Contract source code not verified on Etherscan. Please provide ABI manually."
    );
  }

  // Validate that result is valid JSON
  try {
    const abi = JSON.parse(data.result);
    if (!Array.isArray(abi)) {
      throw new Error("Invalid ABI format: expected array");
    }
    return data.result;
  } catch (error) {
    throw new Error(
      `Invalid ABI format from Etherscan: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Fetch ABI from Etherscan API with proxy detection
 */
async function fetchAbiFromEtherscan(
  contractAddress: string,
  network: string
): Promise<{
  abi: string;
  isProxy: boolean;
  implementationAddress?: string;
  proxyAddress?: string;
  warning?: string;
}> {
  console.log("[Etherscan] fetchAbiFromEtherscan called with:", {
    contractAddress,
    network,
  });

  if (!ETHERSCAN_API_KEY) {
    console.error("[Etherscan] API key not configured");
    throw new Error("Etherscan API key not configured");
  }

  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    console.error("[Etherscan] Invalid contract address:", contractAddress);
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }

  const { baseUrl, chainId, explorerApiType } =
    await getExplorerApiConfig(network);
  console.log("[Etherscan] Base URL:", baseUrl);
  console.log("[Etherscan] Chain ID:", chainId);
  console.log("[Etherscan] Explorer API Type:", explorerApiType);

  // Proxy detection only works for Etherscan-based explorers
  // Blockscout and other explorers don't support getsourcecode the same way
  if (explorerApiType === "etherscan") {
    // First, check if this is a proxy contract using getsourcecode
    console.log("[Etherscan] Checking for proxy contract...");
    const sourceCodeResult = await fetchEtherscanSourceCode(
      baseUrl,
      chainId,
      contractAddress,
      ETHERSCAN_API_KEY
    );

    if (!sourceCodeResult.success) {
      console.error(
        "[Etherscan] Failed to fetch source code:",
        sourceCodeResult.error
      );
      // Fall back to regular ABI fetch
      const abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
      return {
        abi,
        isProxy: false,
      };
    }

    // Check if it's a proxy
    if (sourceCodeResult.isProxy && sourceCodeResult.implementationAddress) {
      console.log(
        "[Etherscan] Proxy detected. Implementation:",
        sourceCodeResult.implementationAddress
      );

      // Validate implementation address
      if (!ethers.isAddress(sourceCodeResult.implementationAddress)) {
        console.warn(
          "[Etherscan] Invalid implementation address, using proxy ABI"
        );
        const proxyAbi = await fetchAbiFromAddress(
          baseUrl,
          chainId,
          contractAddress
        );
        return {
          abi: proxyAbi,
          isProxy: true,
          proxyAddress: contractAddress,
          warning:
            "Implementation contract address is invalid. Using proxy ABI.",
        };
      }

      // Try to fetch ABI from implementation address
      try {
        console.log("[Etherscan] Fetching ABI from implementation address...");
        const implementationAbi = await fetchAbiFromAddress(
          baseUrl,
          chainId,
          sourceCodeResult.implementationAddress
        );

        return {
          abi: implementationAbi,
          isProxy: true,
          implementationAddress: sourceCodeResult.implementationAddress,
          proxyAddress: contractAddress,
        };
      } catch (error) {
        console.warn(
          "[Etherscan] Failed to fetch implementation ABI:",
          error instanceof Error ? error.message : "Unknown error"
        );

        // Fall back to proxy ABI if available
        try {
          const proxyAbi = await fetchAbiFromAddress(
            baseUrl,
            chainId,
            contractAddress
          );
          return {
            abi: proxyAbi,
            isProxy: true,
            implementationAddress: sourceCodeResult.implementationAddress,
            proxyAddress: contractAddress,
            warning: "Implementation contract not verified. Using proxy ABI.",
          };
        } catch (proxyError) {
          // If proxy ABI also fails, throw the original error
          throw error;
        }
      }
    }

    // Not a proxy, fetch ABI normally
    console.log("[Etherscan] Not a proxy, fetching ABI normally...");
    const abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
    return {
      abi,
      isProxy: false,
    };
  }

  // For non-Etherscan explorers (Blockscout, etc.), skip proxy detection
  // and fetch ABI normally
  console.log(
    "[Etherscan] Non-Etherscan explorer, skipping proxy detection..."
  );
  const abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
  return {
    abi,
    isProxy: false,
  };
}

export async function POST(request: Request) {
  try {
    console.log("[Etherscan] POST request received");

    // Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      console.log("[Etherscan] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Etherscan] User authenticated:", session.user.id);

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as {
      contractAddress?: string;
      network?: string;
    };

    console.log("[Etherscan] Request body:", body);

    const { contractAddress, network } = body;

    if (!contractAddress) {
      console.log("[Etherscan] Missing contract address");
      return NextResponse.json(
        { error: "Contract address is required" },
        { status: 400 }
      );
    }

    if (!network) {
      console.log("[Etherscan] Missing network");
      return NextResponse.json(
        { error: "Network is required" },
        { status: 400 }
      );
    }

    console.log("[Etherscan] Fetching ABI for:", { contractAddress, network });

    // Fetch ABI from Etherscan with proxy detection
    const result = await fetchAbiFromEtherscan(contractAddress, network);

    console.log(
      "[Etherscan] Successfully fetched ABI, length:",
      result.abi.length
    );
    if (result.isProxy) {
      console.log("[Etherscan] Proxy detected:", {
        implementation: result.implementationAddress,
        proxy: result.proxyAddress,
      });
    }

    return NextResponse.json({
      success: true,
      abi: result.abi,
      isProxy: result.isProxy,
      implementationAddress: result.implementationAddress,
      proxyAddress: result.proxyAddress,
      warning: result.warning,
    });
  } catch (error) {
    return apiError(error, "Failed to fetch ABI from Etherscan");
  }
}
