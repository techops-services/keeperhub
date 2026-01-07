/**
 * Seed script for default blockchain chains
 *
 * RPC URL resolution priority:
 *   1. CHAIN_RPC_CONFIG JSON (for Helm/AWS Parameter Store)
 *   2. Individual env vars (CHAIN_ETH_MAINNET_PRIMARY_RPC, etc.)
 *   3. Public RPC defaults (no API keys required)
 *
 * Run with: pnpm tsx scripts/seed-chains.ts
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chains, type NewChain } from "../lib/db/schema";
import {
  createRpcUrlResolver,
  getWssUrl,
  PUBLIC_RPCS,
  parseRpcConfig,
} from "../lib/rpc/rpc-config";

// Parse JSON config from environment (if available)
const rpcConfig = (() => {
  const config = parseRpcConfig(process.env.CHAIN_RPC_CONFIG);
  if (process.env.CHAIN_RPC_CONFIG && Object.keys(config).length === 0) {
    console.warn("Failed to parse CHAIN_RPC_CONFIG, using individual env vars");
  }
  return config;
})();

// Create resolver function for this script
const getRpcUrl = createRpcUrlResolver(rpcConfig);

const DEFAULT_CHAINS: NewChain[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    defaultPrimaryRpc: getRpcUrl(
      "eth-mainnet",
      "CHAIN_ETH_MAINNET_PRIMARY_RPC",
      PUBLIC_RPCS.ETH_MAINNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "eth-mainnet",
      "CHAIN_ETH_MAINNET_FALLBACK_RPC",
      PUBLIC_RPCS.ETH_MAINNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "eth-mainnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "eth-mainnet",
      type: "fallback",
    }),
    explorerUrl: "https://etherscan.io",
    explorerApiUrl: "https://api.etherscan.io/v2/api",
    explorerAbiApiUrl: "https://api.etherscan.io/v2/api",
    explorerBalanceApiUrl: "https://api.etherscan.io/v2/api",
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 11_155_111,
    name: "Sepolia Testnet",
    symbol: "ETH",
    defaultPrimaryRpc: getRpcUrl(
      "sepolia",
      "CHAIN_SEPOLIA_PRIMARY_RPC",
      PUBLIC_RPCS.SEPOLIA,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "sepolia",
      "CHAIN_SEPOLIA_FALLBACK_RPC",
      PUBLIC_RPCS.SEPOLIA,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "sepolia",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "sepolia",
      type: "fallback",
    }),
    explorerUrl: "https://sepolia.etherscan.io",
    explorerApiUrl: "https://api-sepolia.etherscan.io/v2/api",
    explorerAbiApiUrl: "https://api-sepolia.etherscan.io/v2/api",
    explorerBalanceApiUrl: "https://api-sepolia.etherscan.io/v2/api",
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    defaultPrimaryRpc: getRpcUrl(
      "base-mainnet",
      "CHAIN_BASE_MAINNET_PRIMARY_RPC",
      PUBLIC_RPCS.BASE_MAINNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "base-mainnet",
      "CHAIN_BASE_MAINNET_FALLBACK_RPC",
      PUBLIC_RPCS.BASE_MAINNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "base-mainnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "base-mainnet",
      type: "fallback",
    }),
    explorerUrl: "https://basescan.org",
    explorerApiUrl: "https://api.basescan.org/api",
    explorerAbiApiUrl: "https://api.basescan.org/api",
    explorerBalanceApiUrl: "https://api.basescan.org/api",
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 84_532,
    name: "Base Sepolia",
    symbol: "ETH",
    defaultPrimaryRpc: getRpcUrl(
      "base-sepolia",
      "CHAIN_BASE_SEPOLIA_PRIMARY_RPC",
      PUBLIC_RPCS.BASE_SEPOLIA,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "base-sepolia",
      "CHAIN_BASE_SEPOLIA_FALLBACK_RPC",
      PUBLIC_RPCS.BASE_SEPOLIA,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "base-sepolia",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "base-sepolia",
      type: "fallback",
    }),
    explorerUrl: "https://sepolia.basescan.org",
    explorerApiUrl: "https://api-sepolia.basescan.org/api",
    explorerAbiApiUrl: "https://api-sepolia.basescan.org/api",
    explorerBalanceApiUrl: "https://api-sepolia.basescan.org/api",
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 42_429,
    name: "Tempo Testnet",
    symbol: "USD",
    defaultPrimaryRpc: getRpcUrl(
      "tempo-testnet",
      "CHAIN_TEMPO_TESTNET_PRIMARY_RPC",
      PUBLIC_RPCS.TEMPO_TESTNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "tempo-testnet",
      "CHAIN_TEMPO_TESTNET_FALLBACK_RPC",
      PUBLIC_RPCS.TEMPO_TESTNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "tempo-testnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "tempo-testnet",
      type: "fallback",
    }),
    explorerUrl: "https://explorer.testnet.tempo.xyz",
    explorerApiUrl: "https://explorer.testnet.tempo.xyz/api",
    explorerAbiApiUrl: "https://explorer.testnet.tempo.xyz/api",
    explorerBalanceApiUrl: "https://explorer.testnet.tempo.xyz/api",
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 42_420,
    name: "Tempo",
    symbol: "USD",
    defaultPrimaryRpc: getRpcUrl(
      "tempo-mainnet",
      "CHAIN_TEMPO_MAINNET_PRIMARY_RPC",
      PUBLIC_RPCS.TEMPO_MAINNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "tempo-mainnet",
      "CHAIN_TEMPO_MAINNET_FALLBACK_RPC",
      PUBLIC_RPCS.TEMPO_MAINNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "tempo-mainnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "tempo-mainnet",
      type: "fallback",
    }),
    explorerUrl: "https://explorer.tempo.xyz",
    explorerApiUrl: "https://explorer.tempo.xyz/api",
    explorerAbiApiUrl: "https://explorer.tempo.xyz/api",
    explorerBalanceApiUrl: "https://explorer.tempo.xyz/api",
    isTestnet: false,
    isEnabled: false, // Disabled until mainnet launches
  },
  // Solana chains (non-EVM - uses SolanaProviderManager)
  {
    chainId: 101,
    name: "Solana",
    symbol: "SOL",
    defaultPrimaryRpc: getRpcUrl(
      "solana-mainnet",
      "CHAIN_SOLANA_MAINNET_PRIMARY_RPC",
      PUBLIC_RPCS.SOLANA_MAINNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "solana-mainnet",
      "CHAIN_SOLANA_MAINNET_FALLBACK_RPC",
      PUBLIC_RPCS.SOLANA_MAINNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "solana-mainnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "solana-mainnet",
      type: "fallback",
    }),
    explorerUrl: "https://solscan.io",
    explorerApiUrl: "https://api.solscan.io",
    explorerAbiApiUrl: "https://api.solscan.io",
    explorerBalanceApiUrl: "https://api.solscan.io",
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 103,
    name: "Solana Devnet",
    symbol: "SOL",
    defaultPrimaryRpc: getRpcUrl(
      "solana-devnet",
      "CHAIN_SOLANA_DEVNET_PRIMARY_RPC",
      PUBLIC_RPCS.SOLANA_DEVNET,
      "primary"
    ),
    defaultFallbackRpc: getRpcUrl(
      "solana-devnet",
      "CHAIN_SOLANA_DEVNET_FALLBACK_RPC",
      PUBLIC_RPCS.SOLANA_DEVNET,
      "fallback"
    ),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: "solana-devnet",
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: "solana-devnet",
      type: "fallback",
    }),
    explorerUrl: "https://solscan.io/?cluster=devnet",
    explorerApiUrl: "https://api-devnet.solscan.io",
    explorerAbiApiUrl: "https://api-devnet.solscan.io",
    explorerBalanceApiUrl: "https://api-devnet.solscan.io",
    isTestnet: true,
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
      console.log(
        `  - ${chain.name} (${chain.chainId}) already exists, skipping`
      );
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
