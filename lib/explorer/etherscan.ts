/**
 * Etherscan API v2 ABI fetcher
 *
 * Works for Ethereum, Base, Arbitrum, and other Etherscan-supported chains
 * with a single API key.
 */

type EtherscanResponse = {
  status: string;
  message: string;
  result: string;
};

type EtherscanSourceCodeResponse = {
  status: string;
  message: string;
  result: Array<{
    Proxy?: string;
    Implementation?: string;
    ABI?: string;
    [key: string]: unknown;
  }>;
};

export type AbiResult = {
  success: boolean;
  abi?: unknown[];
  error?: string;
};

export type SourceCodeResult = {
  success: boolean;
  isProxy?: boolean;
  implementationAddress?: string;
  proxyAbi?: string;
  error?: string;
};

/**
 * Fetch ABI from Etherscan API v2
 *
 * @param apiUrl - Base API URL (e.g., "https://api.etherscan.io/v2/api")
 * @param chainId - Chain ID for the request
 * @param contractAddress - Contract address to fetch ABI for
 * @param apiKey - Optional Etherscan API key (recommended for rate limits)
 */
export async function fetchEtherscanAbi(
  apiUrl: string,
  chainId: number,
  contractAddress: string,
  apiKey?: string
): Promise<AbiResult> {
  const params = new URLSearchParams({
    chainid: chainId.toString(),
    module: "contract",
    action: "getabi",
    address: contractAddress,
  });

  if (apiKey) {
    params.set("apikey", apiKey);
  }

  try {
    const response = await fetch(`${apiUrl}?${params}`);
    const data: EtherscanResponse = await response.json();

    if (data.status !== "1") {
      // Parse common Etherscan error messages
      const errorMessage = parseEtherscanError(data.result || data.message);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const abi = JSON.parse(data.result);
    return { success: true, abi };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch source code and proxy metadata from Etherscan API v2
 *
 * @param apiUrl - Base API URL (e.g., "https://api.etherscan.io/v2/api")
 * @param chainId - Chain ID for the request
 * @param contractAddress - Contract address to fetch source code for
 * @param apiKey - Optional Etherscan API key (recommended for rate limits)
 */
export async function fetchEtherscanSourceCode(
  apiUrl: string,
  chainId: number,
  contractAddress: string,
  apiKey?: string
): Promise<SourceCodeResult> {
  const params = new URLSearchParams({
    chainid: chainId.toString(),
    module: "contract",
    action: "getsourcecode",
    address: contractAddress,
  });

  if (apiKey) {
    params.set("apikey", apiKey);
  }

  try {
    const response = await fetch(`${apiUrl}?${params}`);
    const data: EtherscanSourceCodeResponse = await response.json();

    if (data.status !== "1") {
      const errorMessage = parseEtherscanError(
        data.message || "Failed to fetch source code"
      );
      return {
        success: false,
        error: errorMessage,
      };
    }

    if (!data.result || data.result.length === 0) {
      return {
        success: false,
        error: "No source code data returned from Etherscan",
      };
    }

    const contractData = data.result[0];
    const isProxy = contractData.Proxy === "1";
    const implementationAddress = contractData.Implementation;

    return {
      success: true,
      isProxy,
      implementationAddress: implementationAddress || undefined,
      proxyAbi: contractData.ABI || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse Etherscan error messages into user-friendly messages
 */
function parseEtherscanError(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("contract source code not verified")) {
    return "Contract source code is not verified on the block explorer";
  }

  if (lowerMessage.includes("invalid api key")) {
    return "Invalid Etherscan API key";
  }

  if (lowerMessage.includes("rate limit")) {
    return "Rate limit exceeded. Please try again later.";
  }

  if (lowerMessage.includes("invalid address")) {
    return "Invalid contract address";
  }

  return message || "Failed to fetch ABI from Etherscan";
}
