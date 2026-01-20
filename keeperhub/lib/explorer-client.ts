/**
 * Client-side utilities for building blockchain explorer URLs
 *
 * This is a client-side utility that works with chainId directly,
 * without requiring database queries. For server-side code that has
 * access to ExplorerConfig, use @/lib/explorer instead.
 */

/**
 * Map of chainId to explorer configuration
 */
const EXPLORER_MAP: Record<
  number,
  { baseUrl: string; addressPath: string; txPath: string }
> = {
  // Ethereum Mainnet
  1: {
    baseUrl: "https://etherscan.io",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Sepolia Testnet
  11155111: {
    baseUrl: "https://sepolia.etherscan.io",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Base Mainnet
  8453: {
    baseUrl: "https://basescan.org",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Base Sepolia
  84532: {
    baseUrl: "https://sepolia.basescan.org",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Tempo Testnet
  42429: {
    baseUrl: "https://explorer.testnet.tempo.xyz",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Tempo Mainnet
  42420: {
    baseUrl: "https://explorer.tempo.xyz",
    addressPath: "/address/{address}",
    txPath: "/tx/{hash}",
  },
  // Solana Mainnet
  101: {
    baseUrl: "https://solscan.io",
    addressPath: "/account/{address}",
    txPath: "/tx/{hash}",
  },
  // Solana Devnet
  103: {
    baseUrl: "https://solscan.io",
    addressPath: "/account/{address}?cluster=devnet",
    txPath: "/tx/{hash}?cluster=devnet",
  },
};

/**
 * Build explorer URL for a contract address based on network chainId
 *
 * @param chainId - Chain ID as string or number
 * @param address - Contract or wallet address
 * @returns Explorer URL or null if chainId is not supported
 */
export function getExplorerAddressUrl(
  chainId: string | number,
  address: string
): string | null {
  const chainIdNum =
    typeof chainId === "string" ? Number.parseInt(chainId, 10) : chainId;

  if (Number.isNaN(chainIdNum)) {
    return null;
  }

  const explorer = EXPLORER_MAP[chainIdNum];
  if (!explorer) {
    return null;
  }

  return `${explorer.baseUrl}${explorer.addressPath.replace("{address}", address)}`;
}

/**
 * Build explorer URL for a transaction hash based on network chainId
 *
 * @param chainId - Chain ID as string or number
 * @param txHash - Transaction hash
 * @returns Explorer URL or null if chainId is not supported
 */
export function getExplorerTransactionUrl(
  chainId: string | number,
  txHash: string
): string | null {
  const chainIdNum =
    typeof chainId === "string" ? Number.parseInt(chainId, 10) : chainId;

  if (Number.isNaN(chainIdNum)) {
    return null;
  }

  const explorer = EXPLORER_MAP[chainIdNum];
  if (!explorer) {
    return null;
  }

  return `${explorer.baseUrl}${explorer.txPath.replace("{hash}", txHash)}`;
}
