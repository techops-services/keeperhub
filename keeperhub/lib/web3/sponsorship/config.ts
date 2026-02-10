import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chains } from "@/lib/db/schema";

type SponsorshipConfig = {
  enabled: boolean;
  gelatoApiKey: string;
};

let _config: SponsorshipConfig | null = null;

function getSponsorshipConfig(): SponsorshipConfig {
  if (!_config) {
    _config = {
      enabled: process.env.GAS_SPONSORSHIP_ENABLED === "true",
      gelatoApiKey: process.env.GELATO_SPONSOR_API_KEY ?? "",
    };
  }
  return _config;
}

/**
 * Check if gas sponsorship is available for a given chain.
 *
 * Two-layer gating:
 * 1. Global: GAS_SPONSORSHIP_ENABLED env var must be "true"
 * 2. Per-chain: gasConfig.gasSponsorshipEnabled must be true in the chains table
 *
 * Uses the same chains table and gasConfig JSONB field as AdaptiveGasStrategy.
 */
export async function isSponsorshipAvailable(
  chainId: number
): Promise<boolean> {
  const config = getSponsorshipConfig();

  if (!config.enabled) {
    return false;
  }

  if (!config.gelatoApiKey) {
    return false;
  }

  try {
    const chain = await db
      .select({ gasConfig: chains.gasConfig })
      .from(chains)
      .where(eq(chains.chainId, chainId))
      .limit(1);

    if (chain.length === 0) {
      return false;
    }

    const gasConfig = chain[0].gasConfig as Record<string, unknown> | null;
    return gasConfig?.gasSponsorshipEnabled === true;
  } catch (error) {
    console.warn("[Sponsorship] Failed to check chain config:", error);
    return false;
  }
}

/**
 * Get Gelato API key for sponsored transactions.
 * @throws Error if sponsorship is enabled but no API key is configured
 */
export function getGelatoApiKey(): string {
  const config = getSponsorshipConfig();

  if (!config.gelatoApiKey) {
    throw new Error(
      "GELATO_SPONSOR_API_KEY is not configured. Gas sponsorship requires a Gelato API key."
    );
  }

  return config.gelatoApiKey;
}

/** Reset config singleton (for testing) */
export function resetSponsorshipConfig(): void {
  _config = null;
}
