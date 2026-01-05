/**
 * Network utility functions for mapping network names to chain IDs
 */

import { SUPPORTED_CHAIN_IDS } from "./types";

/**
 * Map network name to chain ID
 *
 * Supports both string names (from UI) and numeric chain IDs
 */
export function getChainIdFromNetwork(network: string | number): number {
  // If already a number, return as-is
  if (typeof network === "number") {
    return network;
  }

  // Map string names to chain IDs
  const networkMap: Record<string, number> = {
    mainnet: SUPPORTED_CHAIN_IDS.MAINNET,
    "ethereum-mainnet": SUPPORTED_CHAIN_IDS.MAINNET,
    ethereum: SUPPORTED_CHAIN_IDS.MAINNET,
    sepolia: SUPPORTED_CHAIN_IDS.SEPOLIA,
    "sepolia-testnet": SUPPORTED_CHAIN_IDS.SEPOLIA,
    base: SUPPORTED_CHAIN_IDS.BASE,
    "base-mainnet": SUPPORTED_CHAIN_IDS.BASE,
  };

  const chainId = networkMap[network.toLowerCase()];

  if (!chainId) {
    throw new Error(
      `Unsupported network: ${network}. Supported: ${Object.keys(networkMap).join(", ")}`
    );
  }

  return chainId;
}

/**
 * Get network name from chain ID (for display purposes)
 */
export function getNetworkName(chainId: number): string {
  const chainNames: Record<number, string> = {
    [SUPPORTED_CHAIN_IDS.MAINNET]: "Ethereum Mainnet",
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: "Sepolia Testnet",
    [SUPPORTED_CHAIN_IDS.BASE]: "Base",
  };

  return chainNames[chainId] || `Chain ${chainId}`;
}
