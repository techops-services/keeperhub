/**
 * Seed script for default blockchain chains
 *
 * Run with: pnpm tsx scripts/seed-chains.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chains, type NewChain } from "../lib/db/schema";

const DEFAULT_CHAINS: NewChain[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    defaultPrimaryRpc: "https://chain.techops.services/eth-mainnet",
    defaultFallbackRpc: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    explorerApiUrl: "https://api.etherscan.io/v2/api",
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 11155111,
    name: "Sepolia Testnet",
    symbol: "ETH",
    defaultPrimaryRpc: "https://chain.techops.services/eth-sepolia",
    defaultFallbackRpc: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    explorerApiUrl: "https://api-sepolia.etherscan.io/v2/api",
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    defaultPrimaryRpc: "https://chain.techops.services/base-mainnet",
    defaultFallbackRpc: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    explorerApiUrl: "https://api.basescan.org/api",
    isTestnet: false,
    isEnabled: true,
  },
];

async function seedChains() {
  const connectionString =
    process.env.DATABASE_URL || "postgres://localhost:5432/workflow";

  console.log("Connecting to database...");
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log(`Seeding ${DEFAULT_CHAINS.length} chains...`);

  for (const chain of DEFAULT_CHAINS) {
    // Check if chain already exists
    const existing = await db
      .select()
      .from(chains)
      .where(eq(chains.chainId, chain.chainId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  - ${chain.name} (${chain.chainId}) already exists, skipping`);
      continue;
    }

    await db.insert(chains).values(chain);
    console.log(`  + ${chain.name} (${chain.chainId}) inserted`);
  }

  console.log("Done!");
  await client.end();
  process.exit(0);
}

seedChains().catch((err) => {
  console.error("Error seeding chains:", err);
  process.exit(1);
});
