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
import {
  chains,
  explorerConfigs,
  type NewChain,
  type NewExplorerConfig,
} from "../lib/db/schema";
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

/**
 * Get symbol from CHAIN_RPC_CONFIG if available, otherwise use default
 */
function getSymbol(jsonKey: string, defaultSymbol: string): string {
  return rpcConfig[jsonKey]?.symbol ?? defaultSymbol;
}

const DEFAULT_CHAINS: NewChain[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: getSymbol("eth-mainnet", "ETH"),
    chainType: "evm",
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
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 11_155_111,
    name: "Sepolia Testnet",
    symbol: getSymbol("sepolia", "ETH"),
    chainType: "evm",
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
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 8453,
    name: "Base",
    symbol: getSymbol("base-mainnet", "BASE"),
    chainType: "evm",
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
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 84_532,
    name: "Base Sepolia",
    symbol: getSymbol("base-sepolia", "BASE"),
    chainType: "evm",
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
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 42_429,
    name: "Tempo Testnet",
    symbol: getSymbol("tempo-testnet", "TEMPO"),
    chainType: "evm",
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
    isTestnet: true,
    isEnabled: true,
  },
  {
    chainId: 42_420,
    name: "Tempo",
    symbol: getSymbol("tempo-mainnet", "TEMPO"),
    chainType: "evm",
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
    isTestnet: false,
    isEnabled: false, // Disabled until mainnet launches
  },
  // Solana chains (non-EVM - uses SolanaProviderManager)
  {
    chainId: 101,
    name: "Solana",
    symbol: getSymbol("solana-mainnet", "SOL"),
    chainType: "solana",
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
    isTestnet: false,
    isEnabled: true,
  },
  {
    chainId: 103,
    name: "Solana Devnet",
    symbol: getSymbol("solana-devnet", "SOL"),
    chainType: "solana",
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
    isTestnet: true,
    isEnabled: true,
  },
];

// Explorer configurations for each chain (KEEP-1154)
const EXPLORER_CONFIGS: NewExplorerConfig[] = [
  // Ethereum Mainnet - Etherscan
  {
    chainId: 1,
    chainType: "evm",
    explorerUrl: "https://etherscan.io",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api.etherscan.io/v2/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}#code",
  },
  // Sepolia Testnet - Etherscan
  {
    chainId: 11_155_111,
    chainType: "evm",
    explorerUrl: "https://sepolia.etherscan.io",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api-sepolia.etherscan.io/v2/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}#code",
  },
  // Base - Etherscan (Basescan)
  {
    chainId: 8453,
    chainType: "evm",
    explorerUrl: "https://basescan.org",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api.basescan.org/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}#code",
  },
  // Base Sepolia - Etherscan
  {
    chainId: 84_532,
    chainType: "evm",
    explorerUrl: "https://sepolia.basescan.org",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api-sepolia.basescan.org/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}#code",
  },
  // Tempo Testnet - Blockscout
  {
    chainId: 42_429,
    chainType: "evm",
    explorerUrl: "https://explorer.testnet.tempo.xyz",
    explorerApiType: "blockscout",
    explorerApiUrl: "https://explorer.testnet.tempo.xyz/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}?tab=contract",
  },
  // Tempo Mainnet - Blockscout
  {
    chainId: 42_420,
    chainType: "evm",
    explorerUrl: "https://explorer.tempo.xyz",
    explorerApiType: "blockscout",
    explorerApiUrl: "https://explorer.tempo.xyz/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}?tab=contract",
  },
  // Solana Mainnet - Solscan
  {
    chainId: 101,
    chainType: "solana",
    explorerUrl: "https://solscan.io",
    explorerApiType: "solscan",
    explorerApiUrl: "https://api.solscan.io",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/account/{address}",
    explorerContractPath: "/account/{address}#anchorProgramIDL",
  },
  // Solana Devnet - Solscan
  {
    chainId: 103,
    chainType: "solana",
    explorerUrl: "https://solscan.io/?cluster=devnet",
    explorerApiType: "solscan",
    explorerApiUrl: "https://api-devnet.solscan.io",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/account/{address}",
    explorerContractPath: "/account/{address}#anchorProgramIDL",
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
      // Update existing chain with new values (except id and timestamps)
      await db
        .update(chains)
        .set({
          name: chain.name,
          symbol: chain.symbol,
          chainType: chain.chainType,
          defaultPrimaryRpc: chain.defaultPrimaryRpc,
          defaultFallbackRpc: chain.defaultFallbackRpc,
          defaultPrimaryWss: chain.defaultPrimaryWss,
          defaultFallbackWss: chain.defaultFallbackWss,
          isTestnet: chain.isTestnet,
          isEnabled: chain.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(chains.chainId, chain.chainId));
      console.log(`  ~ ${chain.name} (${chain.chainId}) updated`);
      continue;
    }

    await db.insert(chains).values(chain);
    console.log(`  + ${chain.name} (${chain.chainId}) inserted`);
  }

  console.log(`\nSeeding ${EXPLORER_CONFIGS.length} explorer configs...`);

  for (const config of EXPLORER_CONFIGS) {
    // Check if explorer config already exists for this chain
    const existing = await db
      .select()
      .from(explorerConfigs)
      .where(eq(explorerConfigs.chainId, config.chainId))
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `  - Explorer config for chain ${config.chainId} already exists, skipping`
      );
      continue;
    }

    await db.insert(explorerConfigs).values(config);
    console.log(
      `  + Explorer config for chain ${config.chainId} (${config.explorerApiType}) inserted`
    );
  }

  console.log("\nDone!");
  await client.end();
  process.exit(0);
}

seedChains().catch((err) => {
  console.error("Error seeding chains:", err);
  process.exit(1);
});
