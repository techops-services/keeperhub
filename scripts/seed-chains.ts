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
  CHAIN_CONFIG,
  getConfigValue,
  getRpcUrlByChainId,
  getWssUrl,
  parseRpcConfigWithDetails,
} from "../lib/rpc/rpc-config";

// Parse JSON config from environment (if available) - used for WSS URLs and config values
const rpcConfig = (() => {
  const envValue = process.env.CHAIN_RPC_CONFIG;
  const result = parseRpcConfigWithDetails(envValue);

  if (envValue && Object.keys(result.config).length === 0) {
    console.warn("Failed to parse CHAIN_RPC_CONFIG, using individual env vars");
    if (result.error) {
      console.warn(`  Parse error: ${result.error}`);
    }
    if (result.rawValue) {
      console.warn(`  Raw value (truncated): ${result.rawValue}`);
    }
    console.warn(`  Value length: ${envValue.length} characters`);
    console.warn(
      `  First char code: ${envValue.charCodeAt(0)} (expected 123 for '{')`
    );
  }

  return result.config;
})();

// Helper to get config value with rpcConfig pre-bound
const getChainConfigValue = <T>(
  jsonKey: string,
  field: "chainId" | "symbol" | "isEnabled" | "isTestnet",
  defaultValue: T
): T => getConfigValue(rpcConfig, jsonKey, field, defaultValue);

const DEFAULT_CHAINS: NewChain[] = [
  {
    chainId: getChainConfigValue("eth-mainnet", "chainId", 1),
    name: "Ethereum Mainnet",
    symbol: getChainConfigValue("eth-mainnet", "symbol", "ETH"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(1, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(1, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[1].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[1].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("eth-mainnet", "isTestnet", false),
    isEnabled: getChainConfigValue("eth-mainnet", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("eth-sepolia", "chainId", 11_155_111),
    name: "Sepolia Testnet",
    symbol: getChainConfigValue("eth-sepolia", "symbol", "ETH"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(11_155_111, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(11_155_111, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[11_155_111].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[11_155_111].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("eth-sepolia", "isTestnet", true),
    isEnabled: getChainConfigValue("eth-sepolia", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("base-mainnet", "chainId", 8453),
    name: "Base",
    symbol: getChainConfigValue("base-mainnet", "symbol", "BASE"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(8453, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(8453, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[8453].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[8453].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("base-mainnet", "isTestnet", false),
    isEnabled: getChainConfigValue("base-mainnet", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("base-testnet", "chainId", 84_532),
    name: "Base Sepolia",
    symbol: getChainConfigValue("base-testnet", "symbol", "BASE"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(84_532, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(84_532, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[84_532].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[84_532].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("base-testnet", "isTestnet", true),
    isEnabled: getChainConfigValue("base-testnet", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("tempo-testnet", "chainId", 42_429),
    name: "Tempo Testnet",
    symbol: getChainConfigValue("tempo-testnet", "symbol", "TEMPO"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(42_429, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(42_429, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[42_429].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[42_429].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("tempo-testnet", "isTestnet", true),
    isEnabled: getChainConfigValue("tempo-testnet", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("tempo-mainnet", "chainId", 42_420),
    name: "Tempo",
    symbol: getChainConfigValue("tempo-mainnet", "symbol", "TEMPO"),
    chainType: "evm",
    defaultPrimaryRpc: getRpcUrlByChainId(42_420, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(42_420, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[42_420].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[42_420].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("tempo-mainnet", "isTestnet", false),
    isEnabled: getChainConfigValue("tempo-mainnet", "isEnabled", false),
  },
  // Solana chains (non-EVM - uses SolanaProviderManager)
  {
    chainId: getChainConfigValue("solana-mainnet", "chainId", 101),
    name: "Solana",
    symbol: getChainConfigValue("solana-mainnet", "symbol", "SOL"),
    chainType: "solana",
    defaultPrimaryRpc: getRpcUrlByChainId(101, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(101, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[101].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[101].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("solana-mainnet", "isTestnet", false),
    isEnabled: getChainConfigValue("solana-mainnet", "isEnabled", true),
  },
  {
    chainId: getChainConfigValue("solana-testnet", "chainId", 103),
    name: "Solana Devnet",
    symbol: getChainConfigValue("solana-testnet", "symbol", "SOL"),
    chainType: "solana",
    defaultPrimaryRpc: getRpcUrlByChainId(103, "primary"),
    defaultFallbackRpc: getRpcUrlByChainId(103, "fallback"),
    defaultPrimaryWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[103].jsonKey,
      type: "primary",
    }),
    defaultFallbackWss: getWssUrl({
      rpcConfig,
      jsonKey: CHAIN_CONFIG[103].jsonKey,
      type: "fallback",
    }),
    isTestnet: getChainConfigValue("solana-testnet", "isTestnet", true),
    isEnabled: getChainConfigValue("solana-testnet", "isEnabled", true),
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
  // Sepolia Testnet - Etherscan (uses unified V2 API with chainid param)
  {
    chainId: 11_155_111,
    chainType: "evm",
    explorerUrl: "https://sepolia.etherscan.io",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api.etherscan.io/v2/api",
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
      // Note: Use ?? null to ensure undefined values are explicitly set to null,
      // otherwise Drizzle skips undefined fields in UPDATE statements
      await db
        .update(chains)
        .set({
          name: chain.name,
          symbol: chain.symbol,
          chainType: chain.chainType,
          defaultPrimaryRpc: chain.defaultPrimaryRpc,
          defaultFallbackRpc: chain.defaultFallbackRpc ?? null,
          defaultPrimaryWss: chain.defaultPrimaryWss ?? null,
          defaultFallbackWss: chain.defaultFallbackWss ?? null,
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
      // Update existing explorer config with new values (except id and timestamps)
      await db
        .update(explorerConfigs)
        .set({
          chainType: config.chainType,
          explorerUrl: config.explorerUrl,
          explorerApiType: config.explorerApiType,
          explorerApiUrl: config.explorerApiUrl,
          explorerTxPath: config.explorerTxPath,
          explorerAddressPath: config.explorerAddressPath,
          explorerContractPath: config.explorerContractPath,
          updatedAt: new Date(),
        })
        .where(eq(explorerConfigs.chainId, config.chainId));
      console.log(
        `  ~ Explorer config for chain ${config.chainId} (${config.explorerApiType}) updated`
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
