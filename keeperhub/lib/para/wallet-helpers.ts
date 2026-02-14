import "server-only";
import { ParaEthersSigner } from "@getpara/ethers-v6-integration";
import { Environment, Para as ParaServer } from "@getpara/server-sdk";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { decryptUserShare } from "@/keeperhub/lib/encryption";
import { logInfrastructureError } from "@/keeperhub/lib/logging";
import { db } from "@/lib/db";
import { paraWallets } from "@/lib/db/schema";

/**
 * Get organization's Para wallet from database
 * @throws Error if wallet not found
 */
export async function getOrganizationWallet(organizationId: string) {
  const wallet = await db
    .select()
    .from(paraWallets)
    .where(eq(paraWallets.organizationId, organizationId))
    .limit(1);

  if (wallet.length === 0) {
    throw new Error("No Para wallet found for organization");
  }

  return wallet[0];
}

/**
 * @deprecated Use getOrganizationWallet instead
 * Kept for backwards compatibility during migration
 */
export async function getUserWallet(userId: string) {
  const wallet = await db
    .select()
    .from(paraWallets)
    .where(eq(paraWallets.userId, userId))
    .limit(1);

  if (wallet.length === 0) {
    throw new Error("No Para wallet found for user");
  }

  return wallet[0];
}

/**
 * Initialize Para signer for organization
 * This signer can sign transactions using the organization's Para wallet
 *
 * @param organizationId - Organization ID from session
 * @param rpcUrl - Blockchain RPC URL (e.g., Ethereum mainnet, Polygon, etc.)
 * @returns Para Ethers signer ready to sign transactions
 */
export async function initializeParaSigner(
  organizationId: string,
  rpcUrl: string
): Promise<ParaEthersSigner> {
  const PARA_API_KEY = process.env.PARA_API_KEY;
  const PARA_ENV = process.env.PARA_ENVIRONMENT || "beta";

  if (!PARA_API_KEY) {
    console.error("[Para] PARA_API_KEY not configured");
    logInfrastructureError(
      "[Para] PARA_API_KEY not configured",
      new Error("PARA_API_KEY environment variable is not configured"),
      {
        component: "para-service",
        service: "para",
      }
    );
    throw new Error("PARA_API_KEY not configured");
  }

  // Get organization's wallet from database
  const wallet = await getOrganizationWallet(organizationId);

  // Initialize Para client
  const paraClient = new ParaServer(
    PARA_ENV === "prod" ? Environment.PROD : Environment.BETA,
    PARA_API_KEY
  );

  // Decrypt and set user's keyshare
  const decryptedShare = decryptUserShare(wallet.userShare);
  await paraClient.setUserShare(decryptedShare);

  // Create blockchain provider and signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ParaEthersSigner(paraClient, provider);

  return signer;
}

/**
 * Get organization's wallet address
 * Useful for displaying wallet address in UI
 */
export async function getOrganizationWalletAddress(
  organizationId: string
): Promise<string> {
  const wallet = await getOrganizationWallet(organizationId);
  return wallet.walletAddress;
}

/**
 * Check if organization has a Para wallet
 */
export async function organizationHasWallet(
  organizationId: string
): Promise<boolean> {
  const wallet = await db
    .select()
    .from(paraWallets)
    .where(eq(paraWallets.organizationId, organizationId))
    .limit(1);

  return wallet.length > 0;
}

/**
 * @deprecated Use getOrganizationWalletAddress instead
 */
export async function getUserWalletAddress(userId: string): Promise<string> {
  const wallet = await getUserWallet(userId);
  return wallet.walletAddress;
}

/**
 * @deprecated Use organizationHasWallet instead
 */
export async function userHasWallet(userId: string): Promise<boolean> {
  const wallet = await db
    .select()
    .from(paraWallets)
    .where(eq(paraWallets.userId, userId))
    .limit(1);

  return wallet.length > 0;
}
