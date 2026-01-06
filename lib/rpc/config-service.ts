/**
 * RPC Config Service - Resolves RPC configuration for users
 *
 * Priority: User preferences > Chain defaults
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chains,
  type NewUserRpcPreference,
  type UserRpcPreference,
  userRpcPreferences,
} from "@/lib/db/schema";
import type { ResolvedRpcConfig } from "./types";

/**
 * Resolve the RPC configuration for a specific chain and user
 *
 * Returns user's custom config if set, otherwise chain defaults
 */
export async function resolveRpcConfig(
  chainId: number,
  userId?: string
): Promise<ResolvedRpcConfig | null> {
  // Get chain defaults first
  const chainResults = await db
    .select()
    .from(chains)
    .where(and(eq(chains.chainId, chainId), eq(chains.isEnabled, true)))
    .limit(1);

  const chain = chainResults[0];
  if (!chain) {
    return null; // Chain not found or disabled
  }

  // Check for user preferences if userId provided
  if (userId) {
    const prefResults = await db
      .select()
      .from(userRpcPreferences)
      .where(
        and(
          eq(userRpcPreferences.userId, userId),
          eq(userRpcPreferences.chainId, chainId)
        )
      )
      .limit(1);

    const userPref = prefResults[0];
    if (userPref) {
      return {
        chainId: chain.chainId,
        chainName: chain.name,
        primaryRpcUrl: userPref.primaryRpcUrl,
        fallbackRpcUrl: userPref.fallbackRpcUrl || undefined,
        source: "user",
      };
    }
  }

  // Return chain defaults
  return {
    chainId: chain.chainId,
    chainName: chain.name,
    primaryRpcUrl: chain.defaultPrimaryRpc,
    fallbackRpcUrl: chain.defaultFallbackRpc || undefined,
    source: "default",
  };
}

/**
 * Get all RPC configs for a user (with defaults for chains without preferences)
 */
export async function resolveAllRpcConfigs(
  userId?: string
): Promise<ResolvedRpcConfig[]> {
  // Get all enabled chains
  const enabledChains = await db
    .select()
    .from(chains)
    .where(eq(chains.isEnabled, true));

  // Get user preferences if userId provided
  const userPrefs: UserRpcPreference[] = userId
    ? await db
        .select()
        .from(userRpcPreferences)
        .where(eq(userRpcPreferences.userId, userId))
    : [];

  // Build a map of user preferences by chainId
  const prefsByChain = new Map(userPrefs.map((p) => [p.chainId, p]));

  // Resolve configs for all chains
  return enabledChains.map((chain) => {
    const userPref = prefsByChain.get(chain.chainId);

    if (userPref) {
      return {
        chainId: chain.chainId,
        chainName: chain.name,
        primaryRpcUrl: userPref.primaryRpcUrl,
        fallbackRpcUrl: userPref.fallbackRpcUrl || undefined,
        source: "user" as const,
      };
    }

    return {
      chainId: chain.chainId,
      chainName: chain.name,
      primaryRpcUrl: chain.defaultPrimaryRpc,
      fallbackRpcUrl: chain.defaultFallbackRpc || undefined,
      source: "default" as const,
    };
  });
}

/**
 * Get user's RPC preferences
 */
export async function getUserRpcPreferences(
  userId: string
): Promise<UserRpcPreference[]> {
  return await db
    .select()
    .from(userRpcPreferences)
    .where(eq(userRpcPreferences.userId, userId));
}

/**
 * Set or update user's RPC preference for a chain
 */
export async function setUserRpcPreference(
  userId: string,
  chainId: number,
  primaryRpcUrl: string,
  fallbackRpcUrl?: string
): Promise<UserRpcPreference> {
  // Check if preference already exists
  const existing = await db
    .select()
    .from(userRpcPreferences)
    .where(
      and(
        eq(userRpcPreferences.userId, userId),
        eq(userRpcPreferences.chainId, chainId)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update existing
    const results = await db
      .update(userRpcPreferences)
      .set({
        primaryRpcUrl,
        fallbackRpcUrl: fallbackRpcUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(userRpcPreferences.id, existing[0].id))
      .returning();

    return results[0];
  }

  // Insert new
  const values: NewUserRpcPreference = {
    userId,
    chainId,
    primaryRpcUrl,
    fallbackRpcUrl: fallbackRpcUrl || null,
  };

  const results = await db
    .insert(userRpcPreferences)
    .values(values)
    .returning();

  return results[0];
}

/**
 * Delete user's RPC preference for a chain (reverts to defaults)
 */
export async function deleteUserRpcPreference(
  userId: string,
  chainId: number
): Promise<boolean> {
  const result = await db
    .delete(userRpcPreferences)
    .where(
      and(
        eq(userRpcPreferences.userId, userId),
        eq(userRpcPreferences.chainId, chainId)
      )
    )
    .returning();

  return result.length > 0;
}
