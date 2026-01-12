/**
 * Blockscout API ABI fetcher
 *
 * Works for Blockscout-based explorers (e.g., Tempo).
 * No API key required.
 */

type BlockscoutResponse = {
  status: string;
  message: string;
  result: string;
};

export type AbiResult = {
  success: boolean;
  abi?: unknown[];
  error?: string;
};

/**
 * Fetch ABI from Blockscout API
 *
 * @param apiUrl - Base API URL (e.g., "https://explorer.tempo.xyz/api")
 * @param contractAddress - Contract address to fetch ABI for
 */
export async function fetchBlockscoutAbi(
  apiUrl: string,
  contractAddress: string
): Promise<AbiResult> {
  const params = new URLSearchParams({
    module: "contract",
    action: "getabi",
    address: contractAddress,
  });

  try {
    const response = await fetch(`${apiUrl}?${params}`);
    const data: BlockscoutResponse = await response.json();

    if (data.status !== "1") {
      // Parse common Blockscout error messages
      const errorMessage = parseBlockscoutError(data.result || data.message);
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
 * Parse Blockscout error messages into user-friendly messages
 */
function parseBlockscoutError(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("contract source code not verified")) {
    return "Contract source code is not verified on the block explorer";
  }

  if (lowerMessage.includes("invalid address")) {
    return "Invalid contract address";
  }

  return message || "Failed to fetch ABI from Blockscout";
}
