import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { explorerConfigs } from "@/lib/db/schema";
import { fetchEtherscanSourceCode } from "@/lib/explorer/etherscan";
import { detectProxyViaRpc } from "@/lib/explorer/proxy-detection";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";

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
 * Fetch contract name from Etherscan API using getsourcecode action
 */
async function fetchContractName(
  baseUrl: string,
  chainId: number,
  address: string
): Promise<string | null> {
  try {
    const sourceCodeResult = await fetchEtherscanSourceCode(
      baseUrl,
      chainId,
      address,
      ETHERSCAN_API_KEY
    );

    if (sourceCodeResult.success && sourceCodeResult.contractName) {
      return sourceCodeResult.contractName;
    }
    return null;
  } catch (error) {
    console.log(
      `[Contract Name] Failed to fetch name for ${address}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
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
 * Diamond loupe ABI for calling facet functions
 * Based on EIP-2535 Diamond standard
 */
const DIAMOND_LOUPE_ABI = [
  {
    inputs: [],
    name: "facets",
    outputs: [
      {
        components: [
          { internalType: "address", name: "facetAddress", type: "address" },
          {
            internalType: "bytes4[]",
            name: "functionSelectors",
            type: "bytes4[]",
          },
        ],
        internalType: "struct IDiamondLoupe.Facet[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "facetAddresses",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Get facet addresses from a Diamond contract using RPC calls
 */
async function getDiamondFacets(
  contractAddress: string,
  chainId: number
): Promise<string[]> {
  // Get RPC config (using default, no user preferences needed for this)
  const rpcConfig = await resolveRpcConfig(chainId);
  if (!rpcConfig) {
    throw new Error(`No RPC config found for chain ${chainId}`);
  }

  const provider = new ethers.JsonRpcProvider(rpcConfig.primaryRpcUrl);
  const diamondContract = new ethers.Contract(
    contractAddress,
    DIAMOND_LOUPE_ABI,
    provider
  );

  // Try to get facet addresses using the loupe interface
  try {
    const facetAddresses = (await diamondContract.facetAddresses()) as string[];
    const validAddresses = facetAddresses.filter((addr) =>
      ethers.isAddress(addr)
    );
    if (validAddresses.length > 0) {
      console.log(
        "[Diamond] Found facets via facetAddresses():",
        validAddresses
      );
      return validAddresses;
    }
  } catch (error) {
    console.log(
      "[Diamond] facetAddresses() not available, trying facets():",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // Fallback: try facets() which returns more detailed info
  try {
    const facets = (await diamondContract.facets()) as Array<{
      facetAddress: string;
      functionSelectors: string[];
    }>;
    const addresses = facets.map((f) => f.facetAddress);
    const validAddresses = addresses.filter((addr) => ethers.isAddress(addr));
    if (validAddresses.length > 0) {
      console.log("[Diamond] Found facets via facets():", validAddresses);
      return validAddresses;
    }
  } catch (facetsError) {
    console.log(
      "[Diamond] Both loupe methods failed:",
      facetsError instanceof Error ? facetsError.message : "Unknown error"
    );
  }

  // If we get here, it's not a Diamond or doesn't implement the loupe interface
  throw new Error("Not a Diamond contract or loupe interface not available");
}

/**
 * Get function selector for an ABI item
 */
function getFunctionSelector(abiItem: {
  type: string;
  name?: string;
  inputs?: Array<{ type: string; name?: string }>;
}): string | null {
  if (abiItem.type !== "function" || !abiItem.name || !abiItem.inputs) {
    return null;
  }
  const signature = `${abiItem.name}(${abiItem.inputs.map((i) => i.type).join(",")})`;
  return ethers.id(signature).slice(0, 10); // First 4 bytes
}

/**
 * Parse and process a single ABI string
 */
function processAbiString(
  abiStr: string,
  seenSelectors: Set<string>
): unknown[] {
  try {
    const abi = JSON.parse(abiStr) as unknown[];
    const items: unknown[] = [];
    let functionCount = 0;
    let duplicateCount = 0;

    for (const item of abi) {
      const abiItem = item as {
        type: string;
        name?: string;
        inputs?: Array<{ type: string; name?: string }>;
      };

      // For functions, check for duplicates by selector
      const selector = getFunctionSelector(abiItem);
      if (selector) {
        functionCount += 1;
        if (seenSelectors.has(selector)) {
          duplicateCount += 1;
          console.log(
            `[Diamond] Skipping duplicate function: ${abiItem.name} (selector: ${selector})`
          );
          continue;
        }
        seenSelectors.add(selector);
      }

      // Include all items (functions, events, errors, etc.)
      items.push(item);
    }

    if (functionCount > 0) {
      const uniqueFunctions = items.filter(
        (i) => (i as { type?: string }).type === "function"
      ).length;
      console.log(
        `[Diamond] Processed ${functionCount} functions (${duplicateCount} duplicates skipped, ${uniqueFunctions} unique)`
      );
    }

    return items;
  } catch (error) {
    console.warn(
      "[Diamond] Failed to parse ABI:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return [];
  }
}

/**
 * Combine multiple ABIs into one, removing duplicates
 */
function combineAbis(abis: string[]): string {
  const allItems: unknown[] = [];
  const seenSelectors = new Set<string>();

  for (const abiStr of abis) {
    const items = processAbiString(abiStr, seenSelectors);
    allItems.push(...items);
  }

  return JSON.stringify(allItems);
}

/**
 * Handle Diamond contract ABI fetching
 */
async function handleDiamondContract(
  contractAddress: string,
  baseUrl: string,
  chainId: number,
  sourceCodeResult: { facetAddresses?: string[] }
): Promise<{
  abi: string;
  isProxy: boolean;
  isDiamond: boolean;
  proxyAddress: string;
  facets: Array<{ address: string; name: string | null; abi?: string }>;
  diamondProxyAbi: string;
  diamondDirectAbi?: string;
  warning?: string;
}> {
  console.log("[Diamond] Diamond contract detected");
  let facetAddresses = sourceCodeResult.facetAddresses || [];

  // If Etherscan didn't provide facets, try to get them via RPC
  if (facetAddresses.length === 0) {
    console.log(
      "[Diamond] No facets from Etherscan, trying RPC loupe calls..."
    );
    try {
      facetAddresses = await getDiamondFacets(contractAddress, chainId);
    } catch (error) {
      console.warn(
        "[Diamond] Failed to get facets via RPC:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw new Error(
        "Diamond contract detected but could not fetch facet addresses. Please ensure the Diamond contract implements the standard loupe interface (EIP-2535)."
      );
    }
  }

  if (facetAddresses.length === 0) {
    throw new Error(
      "Diamond contract detected but no facets found. Please provide ABI manually."
    );
  }

  console.log(
    `[Diamond] Found ${facetAddresses.length} facets:`,
    facetAddresses
  );

  // Fetch ABIs and names for all facets
  const facetAbis: string[] = [];
  const failedFacets: string[] = [];
  const facets: Array<{ address: string; name: string | null; abi?: string }> =
    [];

  const facetPromises = facetAddresses.map(async (facetAddress) => {
    let facetName: string | null = null;
    let facetAbi: string | undefined;

    try {
      facetName = await fetchContractName(baseUrl, chainId, facetAddress);
    } catch (error) {
      console.log(
        `[Diamond] Could not fetch name for facet ${facetAddress}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    // Try to fetch ABI
    try {
      facetAbi = await fetchAbiFromAddress(baseUrl, chainId, facetAddress);
      facetAbis.push(facetAbi);

      facets.push({ address: facetAddress, name: facetName, abi: facetAbi });
      return { success: true, address: facetAddress, hasAbi: true };
    } catch (error) {
      console.warn(
        `[Diamond] Failed to fetch ABI for facet ${facetAddress}${facetName ? ` (${facetName})` : ""}:`,
        error instanceof Error ? error.message : "Unknown error"
      );

      // Store facet with name but no ABI
      facets.push({ address: facetAddress, name: facetName });
      failedFacets.push(facetAddress);
      return { success: false, address: facetAddress, hasAbi: false };
    }
  });

  await Promise.all(facetPromises);

  // Log summary of facets with ABIs
  const facetsWithAbis = facets.filter((f) => f.abi).length;
  console.log(
    `[Diamond] Facet summary: ${facets.length} total facets, ${facetsWithAbis} with ABIs, ${facets.length - facetsWithAbis} without ABIs`
  );

  if (facetAbis.length === 0) {
    throw new Error(
      "Failed to fetch ABIs for any Diamond facets. Please provide ABI manually."
    );
  }

  // Combine all facet ABIs
  const combinedAbi = combineAbis(facetAbis);

  // Log combined ABI stats for debugging
  try {
    const parsedAbi = JSON.parse(combinedAbi) as unknown[];
    const functionCount = parsedAbi.filter(
      (item) => (item as { type?: string }).type === "function"
    ).length;
    console.log(
      `[Diamond] Combined ${facetAbis.length} facet ABIs into one ABI with ${functionCount} total functions`
    );
  } catch (error) {
    console.warn("[Diamond] Failed to parse combined ABI for stats:", error);
  }

  let diamondDirectAbi: string | undefined;
  try {
    console.log("[Diamond] Attempting to fetch Diamond contract's own ABI...");
    diamondDirectAbi = await fetchAbiFromAddress(
      baseUrl,
      chainId,
      contractAddress
    );
    console.log("[Diamond] Successfully fetched Diamond contract's own ABI");
  } catch (error) {
    console.log(
      "[Diamond] Diamond contract's own ABI not available (likely unverified):",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  return {
    abi: combinedAbi,
    isProxy: true,
    isDiamond: true,
    proxyAddress: contractAddress,
    facets,
    diamondProxyAbi: combinedAbi,
    diamondDirectAbi,
    warning:
      failedFacets.length > 0
        ? `Some facets (${failedFacets.length}) could not be fetched. Using available facets.`
        : undefined,
  };
}

/**
 * Validate inputs for ABI fetching
 */
function validateAbiFetchInputs(contractAddress: string): void {
  if (!ETHERSCAN_API_KEY) {
    console.error("[Etherscan] API key not configured");
    throw new Error("Etherscan API key not configured");
  }

  if (!ethers.isAddress(contractAddress)) {
    console.error("[Etherscan] Invalid contract address:", contractAddress);
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }
}

/**
 * Try to detect Diamond contract via RPC
 */
async function tryDetectDiamondViaRpc(
  contractAddress: string,
  baseUrl: string,
  chainId: number
): Promise<{
  abi: string;
  isProxy: boolean;
  isDiamond: boolean;
  proxyAddress: string;
  facets: Array<{ address: string; name: string | null; abi?: string }>;
  diamondProxyAbi: string;
  diamondDirectAbi?: string;
  warning?: string;
} | null> {
  console.log("[Diamond] Attempting to detect Diamond contract via RPC...");
  try {
    const facetAddresses = await getDiamondFacets(contractAddress, chainId);
    if (facetAddresses && facetAddresses.length > 0) {
      console.log(
        `[Diamond] Detected Diamond contract with ${facetAddresses.length} facets via RPC`
      );
      return await handleDiamondContract(contractAddress, baseUrl, chainId, {
        facetAddresses,
      });
    }
  } catch (error) {
    console.log(
      "[Diamond] Not a Diamond contract:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Check if an ABI looks like a proxy contract
 * Proxies typically only have a constructor and a fallback function
 */
function abiLooksLikeProxy(abi: string): boolean {
  try {
    const parsedAbi = JSON.parse(abi) as Array<{
      type: string;
      name?: string;
      stateMutability?: string;
    }>;

    // Filter to only constructor and fallback/receive functions
    const relevantItems = parsedAbi.filter((item) => {
      if (item.type === "constructor") return true;
      if (item.type === "fallback") return true;
      if (item.type === "receive") return true;
      return false;
    });

    // If we only have constructor and fallback/receive, it's likely a proxy
    const hasConstructor = relevantItems.some(
      (item) => item.type === "constructor"
    );
    const hasFallback =
      relevantItems.some((item) => item.type === "fallback") ||
      relevantItems.some((item) => item.type === "receive");

    // Check if there are any other functions (if so, it's probably not a proxy)
    const hasOtherFunctions = parsedAbi.some(
      (item) => item.type === "function" && item.name
    );

    // If it has constructor + fallback but no other functions, it's likely a proxy
    if (hasConstructor && hasFallback && !hasOtherFunctions) {
      console.log(
        "[Proxy Detection] ABI pattern suggests proxy (constructor + fallback only)"
      );
      return true;
    }

    // Also check if it only has fallback (some proxies don't have constructor in ABI)
    if (hasFallback && !hasOtherFunctions && parsedAbi.length <= 2) {
      console.log(
        "[Proxy Detection] ABI pattern suggests proxy (fallback only, minimal ABI)"
      );
      return true;
    }

    return false;
  } catch (error) {
    console.warn(
      "[Proxy Detection] Failed to parse ABI for proxy pattern check:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Fetch proxy ABI from source code result or directly
 */
async function fetchProxyAbi(
  baseUrl: string,
  chainId: number,
  contractAddress: string,
  sourceCodeResult: { proxyAbi?: string }
): Promise<string | undefined> {
  // Try to use ABI from getsourcecode response if available
  if (sourceCodeResult.proxyAbi) {
    try {
      JSON.parse(sourceCodeResult.proxyAbi);
      console.log("[Etherscan] Using proxy ABI from getsourcecode response");
      return sourceCodeResult.proxyAbi;
    } catch {
      console.log(
        "[Etherscan] Proxy ABI from getsourcecode is invalid, will fetch directly"
      );
    }
  }

  // Fetch proxy ABI directly
  try {
    const proxyAbi = await fetchAbiFromAddress(
      baseUrl,
      chainId,
      contractAddress
    );
    console.log("[Etherscan] Fetched proxy ABI directly");
    return proxyAbi;
  } catch (error) {
    console.warn(
      "[Etherscan] Failed to fetch proxy ABI:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return;
  }
}

/**
 * Handle regular proxy contract
 */
async function handleRegularProxy(
  contractAddress: string,
  baseUrl: string,
  chainId: number,
  sourceCodeResult: {
    implementationAddress?: string;
    proxyAbi?: string;
  }
): Promise<{
  abi: string;
  isProxy: boolean;
  implementationAddress: string;
  proxyAddress: string;
  proxyAbi?: string;
  warning?: string;
}> {
  const implementationAddress = sourceCodeResult.implementationAddress;
  if (!implementationAddress) {
    throw new Error("Implementation address is required for proxy contract");
  }

  console.log(
    "[Etherscan] Proxy detected. Implementation:",
    implementationAddress
  );

  // Validate implementation address
  if (!ethers.isAddress(implementationAddress)) {
    console.warn("[Etherscan] Invalid implementation address, using proxy ABI");
    const proxyAbi = await fetchAbiFromAddress(
      baseUrl,
      chainId,
      contractAddress
    );
    return {
      abi: proxyAbi,
      isProxy: true,
      implementationAddress,
      proxyAddress: contractAddress,
      warning: "Implementation contract address is invalid. Using proxy ABI.",
    };
  }

  // Fetch proxy ABI
  const proxyAbi = await fetchProxyAbi(
    baseUrl,
    chainId,
    contractAddress,
    sourceCodeResult
  );

  // Try to fetch ABI from implementation address
  try {
    console.log("[Etherscan] Fetching ABI from implementation address...");
    const implementationAbi = await fetchAbiFromAddress(
      baseUrl,
      chainId,
      implementationAddress
    );

    return {
      abi: implementationAbi,
      isProxy: true,
      implementationAddress,
      proxyAddress: contractAddress,
      proxyAbi,
    };
  } catch (error) {
    console.warn(
      "[Etherscan] Failed to fetch implementation ABI:",
      error instanceof Error ? error.message : "Unknown error"
    );

    if (proxyAbi) {
      return {
        abi: proxyAbi,
        isProxy: true,
        implementationAddress,
        proxyAddress: contractAddress,
        proxyAbi,
        warning: "Implementation contract not verified. Using proxy ABI.",
      };
    }

    throw error;
  }
}

/**
 * Handle Etherscan-based explorer with proxy detection
 */
async function handleEtherscanExplorer(
  contractAddress: string,
  baseUrl: string,
  chainId: number
): Promise<{
  abi: string;
  isProxy: boolean;
  isDiamond?: boolean;
  implementationAddress?: string;
  proxyAddress?: string;
  proxyAbi?: string;
  facets?: Array<{ address: string; name: string | null; abi?: string }>;
  diamondProxyAbi?: string;
  diamondDirectAbi?: string;
  warning?: string;
}> {
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

    // Try to fetch ABI first
    let abi: string;
    try {
      abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
    } catch (error) {
      // If ABI fetch also fails, try RPC detection as fallback
      console.log(
        "[Etherscan] ABI fetch failed, trying RPC-based proxy detection..."
      );
      try {
        const rpcResult = await detectProxyViaRpc(contractAddress, chainId);
        if (rpcResult.isProxy && rpcResult.implementationAddress) {
          // Fetch implementation ABI
          const implementationAbi = await fetchAbiFromAddress(
            baseUrl,
            chainId,
            rpcResult.implementationAddress
          );
          return {
            abi: implementationAbi,
            isProxy: true,
            implementationAddress: rpcResult.implementationAddress,
            proxyAddress: contractAddress,
            warning:
              "Proxy contract automatically detected - using implementation ABI.",
          };
        }
      } catch (rpcError) {
        console.warn(
          "[Etherscan] RPC proxy detection also failed:",
          rpcError instanceof Error ? rpcError.message : "Unknown error"
        );
      }
      // If everything fails, rethrow the original error
      throw error;
    }

    // Check if the fetched ABI looks like a proxy
    if (abiLooksLikeProxy(abi)) {
      console.log(
        "[Etherscan] ABI pattern suggests proxy, trying RPC detection..."
      );
      try {
        const rpcResult = await detectProxyViaRpc(contractAddress, chainId);
        if (rpcResult.isProxy && rpcResult.implementationAddress) {
          // Fetch implementation ABI
          const implementationAbi = await fetchAbiFromAddress(
            baseUrl,
            chainId,
            rpcResult.implementationAddress
          );
          const proxyAbi = await fetchProxyAbi(
            baseUrl,
            chainId,
            contractAddress,
            {}
          );
          return {
            abi: implementationAbi,
            isProxy: true,
            implementationAddress: rpcResult.implementationAddress,
            proxyAddress: contractAddress,
            proxyAbi,
            warning:
              "Proxy contract automatically detected - using implementation ABI.",
          };
        }
      } catch (rpcError) {
        console.warn(
          "[Etherscan] RPC proxy detection failed:",
          rpcError instanceof Error ? rpcError.message : "Unknown error"
        );
      }
    }

    return { abi, isProxy: false };
  }

  if (sourceCodeResult.isDiamond) {
    return await handleDiamondContract(
      contractAddress,
      baseUrl,
      chainId,
      sourceCodeResult
    );
  }

  if (sourceCodeResult.isProxy && sourceCodeResult.implementationAddress) {
    return await handleRegularProxy(
      contractAddress,
      baseUrl,
      chainId,
      sourceCodeResult
    );
  }

  // Etherscan didn't detect a proxy, but check if ABI looks like one
  console.log("[Etherscan] Etherscan didn't detect proxy, fetching ABI...");
  let abi: string;
  try {
    abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
  } catch (error) {
    // If ABI fetch fails, try RPC detection
    console.log(
      "[Etherscan] ABI fetch failed, trying RPC-based proxy detection..."
    );
    try {
      const rpcResult = await detectProxyViaRpc(contractAddress, chainId);
      if (rpcResult.isProxy && rpcResult.implementationAddress) {
        // Fetch implementation ABI
        const implementationAbi = await fetchAbiFromAddress(
          baseUrl,
          chainId,
          rpcResult.implementationAddress
        );
        return {
          abi: implementationAbi,
          isProxy: true,
          implementationAddress: rpcResult.implementationAddress,
          proxyAddress: contractAddress,
          warning: "Proxy detected via RPC.",
        };
      }
    } catch (rpcError) {
      console.warn(
        "[Etherscan] RPC proxy detection also failed:",
        rpcError instanceof Error ? rpcError.message : "Unknown error"
      );
    }
    throw error;
  }

  // Check if ABI looks like a proxy
  if (abiLooksLikeProxy(abi)) {
    console.log(
      "[Etherscan] ABI pattern suggests proxy, trying RPC detection..."
    );
    try {
      const rpcResult = await detectProxyViaRpc(contractAddress, chainId);
      if (rpcResult.isProxy && rpcResult.implementationAddress) {
        // Fetch implementation ABI
        const implementationAbi = await fetchAbiFromAddress(
          baseUrl,
          chainId,
          rpcResult.implementationAddress
        );
        const proxyAbi = await fetchProxyAbi(
          baseUrl,
          chainId,
          contractAddress,
          {}
        );
        return {
          abi: implementationAbi,
          isProxy: true,
          implementationAddress: rpcResult.implementationAddress,
          proxyAddress: contractAddress,
          proxyAbi,
          warning: "Proxy detected via RPC.",
        };
      }
    } catch (rpcError) {
      console.warn(
        "[Etherscan] RPC proxy detection failed:",
        rpcError instanceof Error ? rpcError.message : "Unknown error"
      );
    }
  }

  // Not a proxy
  return { abi, isProxy: false };
}

/**
 * Fetch ABI from Etherscan API with proxy and Diamond detection
 */
async function fetchAbiFromEtherscan(
  contractAddress: string,
  network: string
): Promise<{
  abi: string;
  isProxy: boolean;
  isDiamond?: boolean;
  implementationAddress?: string;
  proxyAddress?: string;
  proxyAbi?: string;
  facets?: Array<{ address: string; name: string | null; abi?: string }>;
  diamondProxyAbi?: string;
  diamondDirectAbi?: string;
  warning?: string;
}> {
  console.log("[Etherscan] fetchAbiFromEtherscan called with:", {
    contractAddress,
    network,
  });

  validateAbiFetchInputs(contractAddress);

  const { baseUrl, chainId, explorerApiType } =
    await getExplorerApiConfig(network);
  console.log("[Etherscan] Base URL:", baseUrl);
  console.log("[Etherscan] Chain ID:", chainId);
  console.log("[Etherscan] Explorer API Type:", explorerApiType);

  // Try Diamond detection via RPC first
  const diamondResult = await tryDetectDiamondViaRpc(
    contractAddress,
    baseUrl,
    chainId
  );
  if (diamondResult) {
    return diamondResult;
  }

  // For Etherscan explorers, check for proxy contracts
  if (explorerApiType === "etherscan") {
    return await handleEtherscanExplorer(contractAddress, baseUrl, chainId);
  }

  // For non-Etherscan explorers, skip proxy detection
  console.log(
    "[Etherscan] Non-Etherscan explorer, skipping proxy detection..."
  );
  const abi = await fetchAbiFromAddress(baseUrl, chainId, contractAddress);
  return { abi, isProxy: false };
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

    return NextResponse.json({
      success: true,
      abi: result.abi,
      isProxy: result.isProxy,
      isDiamond: result.isDiamond,
      implementationAddress: result.implementationAddress,
      proxyAddress: result.proxyAddress,
      proxyAbi: result.proxyAbi,
      facets: result.facets,
      diamondProxyAbi: result.diamondProxyAbi,
      diamondDirectAbi: result.diamondDirectAbi,
      warning: result.warning,
    });
  } catch (error) {
    return apiError(error, "Failed to fetch ABI from Etherscan");
  }
}
