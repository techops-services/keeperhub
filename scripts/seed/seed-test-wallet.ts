/**
 * Seed script for persistent E2E test account
 *
 * Provisions a test user (with login credentials) + organization + Para wallet
 * for write-contract E2E tests and Playwright tests.
 * Idempotent: skips records that already exist.
 *
 * Test credentials:
 *   Email:    e2e-test@keeperhub.test
 *   Password: TestPassword123!
 *
 * Run with: pnpm db:seed-test-wallet
 */

import dotenv from "dotenv";
import { expand } from "dotenv-expand";

expand(dotenv.config());

import { hashPassword } from "better-auth/crypto";
import { Environment, Para as ParaServer } from "@getpara/server-sdk";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { encryptUserShare } from "../../keeperhub/lib/encryption";
import { getDatabaseUrl } from "../../lib/db/connection-utils";
import {
  accounts,
  member,
  organization,
  paraWallets,
  users,
} from "../../lib/db/schema";
import { generateId } from "../../lib/utils/id";

const TEST_ORG_SLUG = "e2e-test-org";
const TEST_USER_EMAIL = "e2e-test@keeperhub.test";
const TEST_PASSWORD = "TestPassword123!";

async function seedTestWallet(): Promise<void> {
  const connectionString = getDatabaseUrl();
  console.log("Connecting to database...");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // --- User ---
    let userId: string;
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, TEST_USER_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`Test user already exists (id: ${userId})`);
    } else {
      userId = generateId();
      await db.insert(users).values({
        id: userId,
        name: "E2E Test User",
        email: TEST_USER_EMAIL,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created test user (id: ${userId})`);
    }

    // --- Credential account (for Playwright login) ---
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.providerId, "credential")
        )
      )
      .limit(1);

    if (existingAccount.length > 0) {
      console.log("Credential account already exists");
    } else {
      const hashedPassword = await hashPassword(TEST_PASSWORD);
      await db.insert(accounts).values({
        id: generateId(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created credential account (password: ${TEST_PASSWORD})`);
    }

    // --- Organization ---
    let orgId: string;
    const existingOrg = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, TEST_ORG_SLUG))
      .limit(1);

    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log(`Test org already exists (id: ${orgId})`);
    } else {
      orgId = generateId();
      await db.insert(organization).values({
        id: orgId,
        name: "E2E Test Organization",
        slug: TEST_ORG_SLUG,
        createdAt: new Date(),
      });
      console.log(`Created test org (id: ${orgId})`);

      // Create member record
      const memberId = generateId();
      await db.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: new Date(),
      });
      console.log(`Created member record (id: ${memberId})`);
    }

    // --- Para wallet ---
    const existingWallet = await db
      .select()
      .from(paraWallets)
      .where(eq(paraWallets.organizationId, orgId))
      .limit(1);

    if (existingWallet.length > 0) {
      console.log(`Wallet already exists: ${existingWallet[0].walletAddress}`);
    } else {
      // Validate Para config
      const PARA_API_KEY = process.env.PARA_API_KEY;
      const PARA_ENV = process.env.PARA_ENVIRONMENT || "beta";

      if (!PARA_API_KEY) {
        throw new Error("PARA_API_KEY is required");
      }
      if (!process.env.WALLET_ENCRYPTION_KEY) {
        throw new Error("WALLET_ENCRYPTION_KEY is required");
      }

      console.log("Creating Para pregenerated wallet...");
      const environment =
        PARA_ENV === "prod" ? Environment.PROD : Environment.BETA;
      const paraClient = new ParaServer(environment, PARA_API_KEY);

      const wallet = await paraClient.createPregenWallet({
        type: "EVM",
        pregenId: { email: TEST_USER_EMAIL },
      });

      const userShare = await paraClient.getUserShare();

      if (!userShare) {
        throw new Error("Failed to get user share from Para");
      }
      if (!(wallet.id && wallet.address)) {
        throw new Error("Invalid wallet data from Para");
      }

      // Encrypt user share and store wallet
      const encryptedShare = encryptUserShare(userShare);

      await db.insert(paraWallets).values({
        id: generateId(),
        userId,
        organizationId: orgId,
        email: TEST_USER_EMAIL,
        walletId: wallet.id,
        walletAddress: wallet.address,
        userShare: encryptedShare,
      });

      console.log(`Created wallet: ${wallet.address}`);
    }

    // --- Summary ---
    const wallet = await db
      .select()
      .from(paraWallets)
      .where(eq(paraWallets.organizationId, orgId))
      .limit(1);

    console.log("\nE2E test account ready:");
    console.log(`  Email:          ${TEST_USER_EMAIL}`);
    console.log(`  Password:       ${TEST_PASSWORD}`);
    console.log(`  Org Slug:       ${TEST_ORG_SLUG}`);
    console.log(`  Org ID:         ${orgId}`);
    console.log(`  User ID:        ${userId}`);
    if (wallet.length > 0) {
      console.log(`  Wallet Address: ${wallet[0].walletAddress}`);
    }
  } finally {
    await client.end();
  }
}

seedTestWallet().catch((err) => {
  console.error("Error seeding test wallet:", err);
  process.exit(1);
});
