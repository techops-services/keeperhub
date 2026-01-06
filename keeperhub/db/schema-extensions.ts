/**
 * KeeperHub Database Schema Extensions
 *
 * This file contains database tables specific to KeeperHub functionality.
 * These are extensions to the base workflow-builder schema.
 *
 * Tables defined here:
 * - paraWallets: Stores Para wallet information for Web3 operations
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
// Note: Using relative paths instead of @/ aliases for drizzle-kit compatibility
import { users } from "../../lib/db/schema";
import { generateId } from "../../lib/utils/id";

/**
 * Para Wallets table
 *
 * Stores user wallet information for Para (Web3) integration.
 * Each user can have one wallet (enforced by unique constraint on userId).
 * The userShare is encrypted before storage for security.
 */
export const paraWallets = pgTable("para_wallets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .unique() // One wallet per user
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  walletId: text("wallet_id").notNull(), // Para wallet ID
  walletAddress: text("wallet_address").notNull(), // EVM address (0x...)
  userShare: text("user_share").notNull(), // Encrypted keyshare for signing
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type exports for the Para Wallets table
export type ParaWallet = typeof paraWallets.$inferSelect;
export type NewParaWallet = typeof paraWallets.$inferInsert;
