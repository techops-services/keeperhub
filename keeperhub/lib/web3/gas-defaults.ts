/**
 * Gas Defaults (Client-Safe)
 *
 * Static map of chain-specific gas limit multiplier defaults.
 * Mirrors the hardcoded overrides in gas-strategy.ts for display purposes only.
 *
 * Execution still uses DB -> hardcoded -> default resolution in gas-strategy.ts.
 * This file is purely informational for the UI.
 */

type ChainGasDefaults = {
  multiplier: number;
  conservative: number;
};

const CHAIN_GAS_DEFAULTS: Record<number, ChainGasDefaults> = {
  // Ethereum mainnet
  1: { multiplier: 2.0, conservative: 2.5 },
  // Sepolia testnet
  11155111: { multiplier: 2.0, conservative: 2.5 },
  // Arbitrum One
  42161: { multiplier: 1.5, conservative: 2.0 },
  // Arbitrum Sepolia
  421614: { multiplier: 1.5, conservative: 2.0 },
  // Base
  8453: { multiplier: 1.5, conservative: 2.0 },
  // Base Sepolia
  84532: { multiplier: 1.5, conservative: 2.0 },
  // Polygon
  137: { multiplier: 2.0, conservative: 2.5 },
  // Polygon Amoy testnet
  80002: { multiplier: 2.0, conservative: 2.5 },
};

const GLOBAL_DEFAULT: ChainGasDefaults = {
  multiplier: 2.0,
  conservative: 2.5,
};

/**
 * Get gas limit multiplier defaults for a chain.
 * Returns global defaults if the chain has no specific overrides.
 */
export function getChainGasDefaults(chainId: number): ChainGasDefaults {
  return CHAIN_GAS_DEFAULTS[chainId] ?? GLOBAL_DEFAULT;
}

/**
 * Get the chain name for display purposes.
 * Returns undefined if the chain ID is not recognized.
 */
export function getChainDisplayName(chainId: number): string | undefined {
  const names: Record<number, string> = {
    1: "Ethereum",
    11155111: "Sepolia",
    42161: "Arbitrum",
    421614: "Arbitrum Sepolia",
    8453: "Base",
    84532: "Base Sepolia",
    137: "Polygon",
    80002: "Polygon Amoy",
  };
  return names[chainId];
}
