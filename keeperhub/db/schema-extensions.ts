/**
 * KeeperHub Database Schema Extensions
 *
 * This file contains database tables specific to KeeperHub functionality.
 * These are extensions to the base workflow-builder schema.
 *
 * Tables defined here:
 * - paraWallets: Stores Para wallet information for Web3 operations
 * - organizationApiKeys: Stores organization-scoped API keys for MCP server authentication
 * - organizationTokens: Tracks ERC20 tokens per organization/chain for balance display
 * - supportedTokens: System-wide default tokens (stablecoins) available on each chain
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
// Note: Using relative paths instead of @/ aliases for drizzle-kit compatibility
import { organization, users, workflows } from "../../lib/db/schema";
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

/**
 * Organization Tokens table
 *
 * Tracks ERC20 tokens that an organization wants to monitor for their wallet.
 * Each row represents a token on a specific chain that the org is tracking.
 */
export const organizationTokens = pgTable(
  "organization_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(), // ERC20 contract address
    symbol: text("symbol").notNull(), // Cached token symbol
    name: text("name").notNull(), // Cached token name
    decimals: integer("decimals").notNull(), // Cached decimals
    logoUrl: text("logo_url"), // Optional token logo
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_org_tokens_org_chain").on(table.organizationId, table.chainId),
  ]
);

// Type exports for Organization Tokens table
export type OrganizationToken = typeof organizationTokens.$inferSelect;
export type NewOrganizationToken = typeof organizationTokens.$inferInsert;

/**
 * Supported Tokens table
 *
 * System-wide default tokens available on each chain. These are pre-configured
 * tokens (primarily stablecoins) that users can select from in workflow nodes
 * like "Check Token Balance" and "Transfer Token".
 *
 * This is different from organizationTokens which are user-added custom tokens.
 * supportedTokens are read-only system defaults managed via seed scripts.
 */
export const supportedTokens = pgTable(
  "supported_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(), // ERC20 contract address (lowercase)
    symbol: text("symbol").notNull(), // e.g., "USDC", "USDT", "DAI"
    name: text("name").notNull(), // e.g., "USD Coin", "Tether USD"
    decimals: integer("decimals").notNull(),
    logoUrl: text("logo_url"), // Optional token logo URL
    isStablecoin: boolean("is_stablecoin").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0), // Display priority
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Ensure unique token per chain
    unique("supported_tokens_chain_address").on(
      table.chainId,
      table.tokenAddress
    ),
    // Index for querying tokens by chain
    index("idx_supported_tokens_chain").on(table.chainId),
  ]
);

// Type exports for Supported Tokens table
export type SupportedToken = typeof supportedTokens.$inferSelect;
export type NewSupportedToken = typeof supportedTokens.$inferInsert;

/**
 * Wallet Locks table
 *
 * Tracks which execution currently holds the lock for a wallet+chain combination.
 * PostgreSQL advisory locks don't persist lock holder info, so we track it here.
 *
 * Used by NonceManager to:
 * - Prevent concurrent workflows from conflicting on nonce assignment
 * - Detect and recover from stale locks (crash recovery)
 *
 * NOTE: The actual locking is done via pg_advisory_lock(), this table only tracks metadata.
 */
export const walletLocks = pgTable(
  "wallet_locks",
  {
    walletAddress: text("wallet_address").notNull(),
    chainId: integer("chain_id").notNull(),
    lockedBy: text("locked_by"), // execution ID that holds the lock (null = unlocked)
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.walletAddress, table.chainId] })]
);

// Type exports for Wallet Locks table
export type WalletLock = typeof walletLocks.$inferSelect;
export type NewWalletLock = typeof walletLocks.$inferInsert;

/**
 * Pending Transactions table
 *
 * Tracks pending blockchain transactions for validation and recovery.
 * Used by NonceManager to:
 * - Reconcile pending txs with chain state at workflow start
 * - Detect stuck transactions that may need gas bumping
 * - Provide observability into transaction state
 *
 * Status lifecycle: pending -> confirmed | dropped | replaced
 */
export const pendingTransactions = pgTable(
  "pending_transactions",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    chainId: integer("chain_id").notNull(),
    nonce: integer("nonce").notNull(),
    txHash: text("tx_hash").notNull(),
    executionId: text("execution_id").notNull(),
    workflowId: text("workflow_id"),
    gasPrice: text("gas_price"), // for stuck tx analysis
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    status: text("status").default("pending"), // pending, confirmed, dropped, replaced
  },
  (table) => [
    unique("pending_tx_wallet_chain_nonce").on(
      table.walletAddress,
      table.chainId,
      table.nonce
    ),
    index("idx_pending_tx_status").on(
      table.walletAddress,
      table.chainId,
      table.status
    ),
    index("idx_pending_tx_execution").on(table.executionId),
  ]
);

// Type exports for Pending Transactions table
export type PendingTransaction = typeof pendingTransactions.$inferSelect;
export type NewPendingTransaction = typeof pendingTransactions.$inferInsert;

/**
 * Public Tags table
 *
 * Global pool of tags used for Hub discoverability. These are distinct from
 * organization-scoped tags -- public tags are shared across all orgs and
 * used for filtering on the Hub page.
 */
export const publicTags = pgTable("public_tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type exports for Public Tags table
export type PublicTag = typeof publicTags.$inferSelect;
export type NewPublicTag = typeof publicTags.$inferInsert;

/**
 * Workflow Public Tags junction table (many-to-many)
 *
 * Links workflows to public tags for Hub discoverability.
 * Cascade deletes on both sides ensure cleanup when either entity is removed.
 */
export const workflowPublicTags = pgTable(
  "workflow_public_tags",
  {
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    publicTagId: text("public_tag_id")
      .notNull()
      .references(() => publicTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.workflowId, table.publicTagId] }),
    index("idx_workflow_public_tags_workflow").on(table.workflowId),
    index("idx_workflow_public_tags_tag").on(table.publicTagId),
  ]
);

// Type exports for Workflow Public Tags table
export type WorkflowPublicTag = typeof workflowPublicTags.$inferSelect;
export type NewWorkflowPublicTag = typeof workflowPublicTags.$inferInsert;
