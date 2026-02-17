/**
 * Gas Defaults (Client-Safe)
 *
 * Static map of chain-specific gas limit multiplier defaults.
 * Mirrors the hardcoded overrides in gas-strategy.ts for display purposes only.
 *
 * Execution still uses DB -> hardcoded -> default resolution in gas-strategy.ts.
 * This file is purely informational for the UI.
 */

export type ChainGasDefaults = {
  multiplier: number;
  conservative: number;
};

/**
 * Gas limit configuration - supports both multiplier and absolute gas limit modes
 */
export type GasLimitConfig =
  | { mode: "multiplier"; value: string }
  | { mode: "maxGasLimit"; value: string };

/**
 * Parse gas limit config from the stored string value.
 *
 * Supports:
 * - New JSON format: '{"mode":"multiplier","value":"2.5"}' or '{"mode":"maxGasLimit","value":"500000"}'
 * - Legacy plain string: "2.5" → treated as { mode: "multiplier", value: "2.5" }
 * - Empty/undefined: returns undefined
 */
export function parseGasLimitConfig(
  raw: string | undefined
): GasLimitConfig | undefined {
  if (!raw || raw.trim() === "") {
    return;
  }

  // Try parsing as JSON first (new format)
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        mode?: string;
        value?: string;
      };
      if (parsed.mode === "multiplier" || parsed.mode === "maxGasLimit") {
        return { mode: parsed.mode, value: parsed.value ?? "" };
      }
    } catch {
      // Fall through to legacy handling
    }
  }

  // Legacy format: plain numeric string → multiplier mode
  return { mode: "multiplier", value: raw };
}

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
