/**
 * KeeperHub Database Schema Extensions
 *
 * This file contains database tables specific to KeeperHub functionality.
 * These are extensions to the base workflow-builder schema.
 *
 * Tables defined here:
 * - paraWallets: Stores Para wallet information for Web3 operations
 * - organizationApiKeys: Stores organization-scoped API keys for MCP server authentication
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
// Note: Using relative paths instead of @/ aliases for drizzle-kit compatibility
import { organization, users } from "../../lib/db/schema";
import { generateId } from "../../lib/utils/id";

/**
 * Para Wallets table
 *
 * Stores organization wallet information for Para (Web3) integration.
 * Each organization can have one wallet (enforced by unique constraint on organizationId).
 * The userShare is encrypted before storage for security.
 *
 * NOTE: userId tracks who created the wallet, but the wallet belongs to the organization.
 * Only organization admins and owners can create/manage wallets.
 */
export const paraWallets = pgTable("para_wallets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // TODO: Make this NOT NULL after migrating existing user wallets to organizations
  organizationId: text("organization_id")
    .unique() // One wallet per organization
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  walletId: text("wallet_id").notNull(), // Para wallet ID
  walletAddress: text("wallet_address").notNull(), // EVM address (0x...)
  userShare: text("user_share").notNull(), // Encrypted keyshare for signing
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type exports for the Para Wallets table
export type ParaWallet = typeof paraWallets.$inferSelect;
export type NewParaWallet = typeof paraWallets.$inferInsert;

/**
 * Organization API Keys table
 *
 * Stores API keys for organization-level authentication.
 * Used by the MCP server to authenticate and access workflows/executions.
 *
 * Security:
 * - Keys are hashed with SHA-256, never stored in plaintext
 * - Only the first 8 chars (prefix) are stored for identification
 * - Keys are scoped to a single organization
 * - Optional expiration and revocation support
 *
 * NOTE: This is separate from the user-scoped apiKeys table in the main schema.
 * Organization keys have broader permissions and are meant for API/MCP access.
 */
export const organizationApiKeys = pgTable("organization_api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-provided label for the key
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification (e.g., "kh_abc12")
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }), // User who created the key
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"), // Track usage for audit
  expiresAt: timestamp("expires_at"), // Optional expiration
  revokedAt: timestamp("revoked_at"), // Soft delete via revocation
});

// Type exports for the Organization API Keys table
export type OrganizationApiKey = typeof organizationApiKeys.$inferSelect;
export type NewOrganizationApiKey = typeof organizationApiKeys.$inferInsert;
