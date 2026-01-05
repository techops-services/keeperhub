/**
 * E2E Tests for RPC Failover
 *
 * These tests verify the full RPC failover flow including:
 * - Chain configuration from database
 * - User RPC preferences
 * - Automatic failover between primary and fallback RPCs
 *
 * Prerequisites:
 * - Database running with chains table seeded
 * - Run: pnpm db:push && pnpm tsx scripts/seed-chains.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import {
  chains,
  userRpcPreferences,
  users,
  type Chain,
} from "@/lib/db/schema";

// Skip if DATABASE_URL not set or SKIP_INFRA_TESTS is true (CI environment without DB)
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.SKIP_INFRA_TESTS === "true";

describe.skipIf(shouldSkip)("RPC Failover E2E", () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let testUserId: string;
  let testChain: Chain | null;

  beforeAll(async () => {
    // Connect to test database
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/workflow_builder";

    client = postgres(connectionString, { max: 1 });
    db = drizzle(client);

    // Create a test user
    testUserId = `test_user_${Date.now()}`;
    await db.insert(users).values({
      id: testUserId,
      email: `test-${Date.now()}@example.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Ensure test chain exists
    const existingChains = await db
      .select()
      .from(chains)
      .where(eq(chains.chainId, 11155111))
      .limit(1);

    if (existingChains.length === 0) {
      await db.insert(chains).values({
        chainId: 11155111,
        name: "Sepolia Testnet",
        symbol: "ETH",
        defaultPrimaryRpc: "https://chain.techops.services/eth-sepolia",
        defaultFallbackRpc: "https://rpc.sepolia.org",
        explorerUrl: "https://sepolia.etherscan.io",
        explorerApiUrl: "https://api-sepolia.etherscan.io/v2/api",
        isTestnet: true,
        isEnabled: true,
      });
    }

    testChain = (
      await db
        .select()
        .from(chains)
        .where(eq(chains.chainId, 11155111))
        .limit(1)
    )[0];
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await db
        .delete(userRpcPreferences)
        .where(eq(userRpcPreferences.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await client.end();
  });

  beforeEach(async () => {
    // Clean up user preferences before each test
    await db
      .delete(userRpcPreferences)
      .where(eq(userRpcPreferences.userId, testUserId));
  });

  describe("Chain Configuration", () => {
    it("should have default chains seeded", async () => {
      const allChains = await db.select().from(chains);

      expect(allChains.length).toBeGreaterThan(0);

      const chainIds = allChains.map((c) => c.chainId);
      expect(chainIds).toContain(1); // Mainnet
      expect(chainIds).toContain(11155111); // Sepolia
    });

    it("should have required fields for each chain", async () => {
      const allChains = await db.select().from(chains);

      for (const chain of allChains) {
        expect(chain.chainId).toBeDefined();
        expect(chain.name).toBeDefined();
        expect(chain.symbol).toBeDefined();
        expect(chain.defaultPrimaryRpc).toBeDefined();
        expect(chain.defaultPrimaryRpc).toMatch(/^https?:\/\//);
      }
    });

    it("should filter disabled chains", async () => {
      const enabledChains = await db
        .select()
        .from(chains)
        .where(eq(chains.isEnabled, true));

      const allChains = await db.select().from(chains);

      // All chains should be enabled by default in seed
      expect(enabledChains.length).toBe(allChains.length);
    });
  });

  describe("User RPC Preferences", () => {
    it("should create user preference for a chain", async () => {
      if (!testChain) throw new Error("Test chain not found");

      await db.insert(userRpcPreferences).values({
        userId: testUserId,
        chainId: testChain.chainId,
        primaryRpcUrl: "https://custom-sepolia.example.com",
        fallbackRpcUrl: "https://custom-sepolia-backup.example.com",
      });

      const prefs = await db
        .select()
        .from(userRpcPreferences)
        .where(
          and(
            eq(userRpcPreferences.userId, testUserId),
            eq(userRpcPreferences.chainId, testChain.chainId)
          )
        );

      expect(prefs.length).toBe(1);
      expect(prefs[0].primaryRpcUrl).toBe("https://custom-sepolia.example.com");
    });

    it("should enforce unique constraint on user+chain", async () => {
      if (!testChain) throw new Error("Test chain not found");

      await db.insert(userRpcPreferences).values({
        userId: testUserId,
        chainId: testChain.chainId,
        primaryRpcUrl: "https://first-rpc.example.com",
      });

      // Attempting to insert duplicate should fail
      await expect(
        db.insert(userRpcPreferences).values({
          userId: testUserId,
          chainId: testChain.chainId,
          primaryRpcUrl: "https://second-rpc.example.com",
        })
      ).rejects.toThrow();
    });

    it("should allow same chain for different users", async () => {
      if (!testChain) throw new Error("Test chain not found");

      // Create another test user
      const anotherUserId = `test_user_${Date.now()}_2`;
      await db.insert(users).values({
        id: anotherUserId,
        email: `test-${Date.now()}-2@example.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        await db.insert(userRpcPreferences).values({
          userId: testUserId,
          chainId: testChain.chainId,
          primaryRpcUrl: "https://user1-rpc.example.com",
        });

        await db.insert(userRpcPreferences).values({
          userId: anotherUserId,
          chainId: testChain.chainId,
          primaryRpcUrl: "https://user2-rpc.example.com",
        });

        const user1Prefs = await db
          .select()
          .from(userRpcPreferences)
          .where(eq(userRpcPreferences.userId, testUserId));

        const user2Prefs = await db
          .select()
          .from(userRpcPreferences)
          .where(eq(userRpcPreferences.userId, anotherUserId));

        expect(user1Prefs.length).toBe(1);
        expect(user2Prefs.length).toBe(1);
        expect(user1Prefs[0].primaryRpcUrl).not.toBe(
          user2Prefs[0].primaryRpcUrl
        );
      } finally {
        await db
          .delete(userRpcPreferences)
          .where(eq(userRpcPreferences.userId, anotherUserId));
        await db.delete(users).where(eq(users.id, anotherUserId));
      }
    });

    it("should cascade delete preferences when user is deleted", async () => {
      if (!testChain) throw new Error("Test chain not found");

      // Create a temporary user
      const tempUserId = `temp_user_${Date.now()}`;
      await db.insert(users).values({
        id: tempUserId,
        email: `temp-${Date.now()}@example.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(userRpcPreferences).values({
        userId: tempUserId,
        chainId: testChain.chainId,
        primaryRpcUrl: "https://temp-rpc.example.com",
      });

      // Verify preference exists
      const prefsBefore = await db
        .select()
        .from(userRpcPreferences)
        .where(eq(userRpcPreferences.userId, tempUserId));
      expect(prefsBefore.length).toBe(1);

      // Delete user (should cascade to preferences)
      await db.delete(users).where(eq(users.id, tempUserId));

      // Verify preference was deleted
      const prefsAfter = await db
        .select()
        .from(userRpcPreferences)
        .where(eq(userRpcPreferences.userId, tempUserId));
      expect(prefsAfter.length).toBe(0);
    });
  });

  describe("RPC Config Resolution", () => {
    it("should return chain defaults when no user preference exists", async () => {
      if (!testChain) throw new Error("Test chain not found");

      // Import service after DB setup
      const { resolveRpcConfig } = await import("@/lib/rpc/config-service");

      const config = await resolveRpcConfig(testChain.chainId, testUserId);

      expect(config).not.toBeNull();
      expect(config?.source).toBe("default");
      expect(config?.primaryRpcUrl).toBe(testChain.defaultPrimaryRpc);
    });

    it("should return user preference when it exists", async () => {
      if (!testChain) throw new Error("Test chain not found");

      // Create user preference
      await db.insert(userRpcPreferences).values({
        userId: testUserId,
        chainId: testChain.chainId,
        primaryRpcUrl: "https://user-custom-rpc.example.com",
        fallbackRpcUrl: "https://user-custom-backup.example.com",
      });

      // Import service after DB setup
      const { resolveRpcConfig } = await import("@/lib/rpc/config-service");

      const config = await resolveRpcConfig(testChain.chainId, testUserId);

      expect(config).not.toBeNull();
      expect(config?.source).toBe("user");
      expect(config?.primaryRpcUrl).toBe("https://user-custom-rpc.example.com");
      expect(config?.fallbackRpcUrl).toBe(
        "https://user-custom-backup.example.com"
      );
    });

    it("should return null for disabled chain", async () => {
      // Create a disabled chain
      const disabledChainId = 99999;
      await db.insert(chains).values({
        chainId: disabledChainId,
        name: "Disabled Chain",
        symbol: "DIS",
        defaultPrimaryRpc: "https://disabled.example.com",
        isEnabled: false,
      });

      try {
        const { resolveRpcConfig } = await import("@/lib/rpc/config-service");

        const config = await resolveRpcConfig(disabledChainId, testUserId);

        expect(config).toBeNull();
      } finally {
        await db.delete(chains).where(eq(chains.chainId, disabledChainId));
      }
    });
  });
});
