/**
 * Seed script for persistent E2E test account
 *
 * Seeds a test user (with login credentials) + organization + Para wallet
 * for write-contract E2E tests and Playwright tests.
 * Idempotent: skips records that already exist.
 *
 * The wallet data is hardcoded from the pre-provisioned Para wallet
 * (same wallet used by keeper-app). This avoids calling the Para API
 * at seed time and ensures deterministic wallet addresses across CI runs.
 *
 * Test credentials:
 *   Email:    PR-TEST-DO-NOT-DELETE@techops.services
 *   Password: TestPassword123!
 *
 * Environment variables:
 *   DATABASE_URL                - PostgreSQL connection string (required)
 *   TEST_WALLET_ENCRYPTION_KEY  - 32-byte hex key for encrypting user share (required for wallet)
 *   TEST_PARA_USER_SHARE        - Raw Para user share base64 string (required for wallet)
 *
 * Run with: pnpm db:seed-test-wallet
 */

import dotenv from "dotenv";
import { expand } from "dotenv-expand";

expand(dotenv.config());

import { hashPassword } from "better-auth/crypto";
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
const TEST_USER_EMAIL = "pr-test-do-not-delete@techops.services";
const TEST_PASSWORD = "TestPassword123!";

// Hardcoded wallet data from pre-provisioned Para wallet
// Same wallet used by keeper-app (KeeperHub Staging partner)
const TEST_WALLET_ID = "d932b702-0436-438f-ae97-2975f35bcf1c";
const TEST_WALLET_ADDRESS = "0x673e3ff5342422b8a2ddc90f78afac9d7e37dbb1";

type Db = ReturnType<typeof drizzle>;

async function ensureUser(db: Db): Promise<string> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_USER_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Test user already exists (id: ${existing[0].id})`);
    return existing[0].id;
  }

  const userId = generateId();
  await db.insert(users).values({
    id: userId,
    name: "E2E Test User",
    email: TEST_USER_EMAIL,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Created test user (id: ${userId})`);
  return userId;
}

async function ensureCredentialAccount(db: Db, userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("Credential account already exists");
    return;
  }

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

async function ensureOrganization(db: Db, userId: string): Promise<string> {
  const existing = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, TEST_ORG_SLUG))
    .limit(1);

  if (existing.length > 0) {
    const orgId = existing[0].id;
    console.log(`Test org already exists (id: ${orgId})`);

    // Ensure member record exists for this user (may be missing if user was re-created)
    const existingMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .limit(1);

    if (existingMember.length === 0) {
      const memberId = generateId();
      await db.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: new Date(),
      });
      console.log(`Created missing member record (id: ${memberId})`);
    }

    return orgId;
  }

  const orgId = generateId();
  await db.insert(organization).values({
    id: orgId,
    name: "E2E Test Organization",
    slug: TEST_ORG_SLUG,
    createdAt: new Date(),
  });
  console.log(`Created test org (id: ${orgId})`);

  const memberId = generateId();
  await db.insert(member).values({
    id: memberId,
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
  console.log(`Created member record (id: ${memberId})`);
  return orgId;
}

async function ensureParaWallet(
  db: Db,
  userId: string,
  orgId: string
): Promise<void> {
  const existing = await db
    .select()
    .from(paraWallets)
    .where(eq(paraWallets.organizationId, orgId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Wallet already exists: ${existing[0].walletAddress}`);
    return;
  }

  const rawUserShare = process.env.TEST_PARA_USER_SHARE;
  if (!rawUserShare) {
    console.log(
      "TEST_PARA_USER_SHARE not set, skipping wallet seed. " +
        "Wallet-dependent tests will be skipped."
    );
    return;
  }

  if (!process.env.WALLET_ENCRYPTION_KEY) {
    console.log(
      "WALLET_ENCRYPTION_KEY not set, skipping wallet seed. " +
        "Wallet-dependent tests will be skipped."
    );
    return;
  }

  const encryptedShare = encryptUserShare(rawUserShare);

  await db.insert(paraWallets).values({
    id: generateId(),
    userId,
    organizationId: orgId,
    email: TEST_USER_EMAIL,
    walletId: TEST_WALLET_ID,
    walletAddress: TEST_WALLET_ADDRESS,
    userShare: encryptedShare,
  });

  console.log(`Created wallet: ${TEST_WALLET_ADDRESS}`);
}

function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed test account: NODE_ENV=production. " +
        "Set ALLOW_SEED_TEST_WALLET=true to override."
    );
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "" ||
      host.endsWith(".svc.cluster.local") ||
      host.endsWith(".internal");

    if (!isLocal && process.env.ALLOW_SEED_TEST_WALLET !== "true") {
      throw new Error(
        `Refusing to seed test account: DATABASE_URL host "${host}" looks like a remote database. ` +
          "Set ALLOW_SEED_TEST_WALLET=true to override."
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return;
    }
    throw error;
  }
}

async function seedTestWallet(): Promise<void> {
  assertNotProduction();

  const connectionString = getDatabaseUrl();
  console.log("Connecting to database...");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    const userId = await ensureUser(db);
    await ensureCredentialAccount(db, userId);
    const orgId = await ensureOrganization(db, userId);
    await ensureParaWallet(db, userId, orgId);

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

seedTestWallet()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding test wallet:", err);
    process.exit(1);
  });
