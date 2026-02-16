/**
 * Fund the persistent test wallet on Sepolia
 *
 * Sends testnet ETH from a funder EOA to the persistent test org's Para wallet.
 * Skips if the wallet already has sufficient balance.
 *
 * Requires:
 *   TESTNET_FUNDER_PK - Private key of a funded Sepolia EOA (in .env)
 *   DATABASE_URL      - Database connection string (in .env)
 *
 * Run with: pnpm db:fund-test-wallet
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { ethers } from "ethers";
import postgres from "postgres";
import { getDatabaseUrl } from "../../lib/db/connection-utils";
import { chains, organization, paraWallets } from "../../lib/db/schema";

const TEST_ORG_SLUG = "e2e-test-org";
const SEPOLIA_CHAIN_ID = 11_155_111;
const FUNDING_AMOUNT = ethers.parseEther("0.002");
const MIN_BALANCE = ethers.parseEther("0.001");

async function main(): Promise<void> {
  const funderPk = process.env.TESTNET_FUNDER_PK;
  if (!funderPk) {
    console.error("TESTNET_FUNDER_PK environment variable is required");
    process.exit(1);
  }

  const databaseUrl = getDatabaseUrl();
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    // Look up test org
    const [testOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, TEST_ORG_SLUG))
      .limit(1);

    if (!testOrg) {
      console.error(
        `Test org "${TEST_ORG_SLUG}" not found. Run pnpm db:seed-test-wallet first.`
      );
      process.exit(1);
    }

    // Look up Para wallet
    const [wallet] = await db
      .select()
      .from(paraWallets)
      .where(eq(paraWallets.organizationId, testOrg.id))
      .limit(1);

    if (!wallet) {
      console.error(
        "No Para wallet for test org. Run pnpm db:seed-test-wallet first."
      );
      process.exit(1);
    }

    const walletAddress = wallet.walletAddress;
    console.log(`Test wallet: ${walletAddress}`);

    // Look up Sepolia RPC from chains table
    const [sepoliaChain] = await db
      .select()
      .from(chains)
      .where(eq(chains.chainId, SEPOLIA_CHAIN_ID))
      .limit(1);

    if (!sepoliaChain) {
      console.error(
        "Sepolia chain not found in DB. Run pnpm db:seed-chains first."
      );
      process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(sepoliaChain.defaultPrimaryRpc);
    const funder = new ethers.Wallet(funderPk, provider);

    console.log(`Funder:      ${funder.address}`);
    console.log(`RPC:         ${sepoliaChain.defaultPrimaryRpc}`);

    // Check funder balance
    const funderBalance = await provider.getBalance(funder.address);
    console.log(`Funder balance: ${ethers.formatEther(funderBalance)} ETH`);

    if (funderBalance < FUNDING_AMOUNT) {
      console.error(
        `Funder has insufficient balance (${ethers.formatEther(funderBalance)} ETH). ` +
          `Need at least ${ethers.formatEther(FUNDING_AMOUNT)} ETH.`
      );
      process.exit(1);
    }

    // Check test wallet balance
    const walletBalance = await provider.getBalance(walletAddress);
    console.log(`Wallet balance: ${ethers.formatEther(walletBalance)} ETH`);

    if (walletBalance >= MIN_BALANCE) {
      console.log(
        `Wallet already has sufficient balance (>= ${ethers.formatEther(MIN_BALANCE)} ETH). Skipping.`
      );
      return;
    }

    // Fund the wallet
    console.log(
      `Sending ${ethers.formatEther(FUNDING_AMOUNT)} ETH to ${walletAddress}...`
    );
    const tx = await funder.sendTransaction({
      to: walletAddress,
      value: FUNDING_AMOUNT,
    });
    console.log(`TX hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(
      `Confirmed in block ${receipt?.blockNumber}. Gas used: ${receipt?.gasUsed.toString()}`
    );

    // Verify new balance
    const newBalance = await provider.getBalance(walletAddress);
    console.log(`New wallet balance: ${ethers.formatEther(newBalance)} ETH`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(
    "Failed to fund test wallet:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
