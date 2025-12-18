"use client";

import { atom } from "jotai";
import type { VercelTeam } from "@/lib/api-client";

/**
 * AI Gateway status (fetched from API)
 */
export type AiGatewayStatus = {
  /** Whether the user keys feature is enabled */
  enabled: boolean;
  /** Whether the user is signed in */
  signedIn: boolean;
  /** Whether the user signed in with Vercel OAuth */
  isVercelUser: boolean;
  /** Whether the user has a managed AI Gateway integration */
  hasManagedKey: boolean;
  /** The ID of the managed integration (if exists) */
  managedIntegrationId?: string;
} | null;

export const aiGatewayStatusAtom = atom<AiGatewayStatus>(null);

/**
 * Vercel teams for the current user
 */
export const aiGatewayTeamsAtom = atom<VercelTeam[]>([]);
export const aiGatewayTeamsLoadingAtom = atom(false);
export const aiGatewayTeamsFetchedAtom = atom(false);
