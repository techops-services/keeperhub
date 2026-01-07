/**
 * Unit tests for RPC URL configuration resolution
 *
 * Tests the priority chain: JSON config → individual env vars → public defaults
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRpcUrl,
  PUBLIC_RPCS,
  parseRpcConfig,
  type RpcConfig,
} from "../../lib/rpc/rpc-config";

describe("RPC Config Resolution", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("parseRpcConfig", () => {
    it("should parse valid JSON config", () => {
      const json = JSON.stringify({
        "eth-mainnet": {
          primary: "https://primary.example.com",
          fallback: "https://fallback.example.com",
        },
      });

      const config = parseRpcConfig(json);

      expect(config["eth-mainnet"]?.primary).toBe(
        "https://primary.example.com"
      );
      expect(config["eth-mainnet"]?.fallback).toBe(
        "https://fallback.example.com"
      );
    });

    it("should return empty object for undefined", () => {
      const config = parseRpcConfig(undefined);
      expect(config).toEqual({});
    });

    it("should return empty object for empty string", () => {
      const config = parseRpcConfig("");
      expect(config).toEqual({});
    });

    it("should return empty object for invalid JSON", () => {
      const config = parseRpcConfig("not valid json {{{");
      expect(config).toEqual({});
    });

    it("should parse config with all chains", () => {
      const json = JSON.stringify({
        "eth-mainnet": { primary: "https://eth.example.com" },
        sepolia: { primary: "https://sepolia.example.com" },
        "base-mainnet": { primary: "https://base.example.com" },
        "solana-mainnet": { primary: "https://solana.example.com" },
      });

      const config = parseRpcConfig(json);

      expect(Object.keys(config)).toHaveLength(4);
      expect(config["eth-mainnet"]?.primary).toBe("https://eth.example.com");
      expect(config["solana-mainnet"]?.primary).toBe(
        "https://solana.example.com"
      );
    });
  });

  describe("getRpcUrl priority", () => {
    it("should prioritize JSON config over env var and public default", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { primary: "https://json-primary.example.com" },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-primary.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      expect(result).toBe("https://json-primary.example.com");
    });

    it("should use env var when JSON config missing chain", () => {
      const rpcConfig: RpcConfig = {
        "other-chain": { primary: "https://other.example.com" },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-primary.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      expect(result).toBe("https://env-primary.example.com");
    });

    it("should use env var when JSON config missing type", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { fallback: "https://json-fallback.example.com" },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-primary.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      expect(result).toBe("https://env-primary.example.com");
    });

    it("should use public default when both JSON and env var missing", () => {
      const rpcConfig: RpcConfig = {};

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: undefined,
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      expect(result).toBe(PUBLIC_RPCS.ETH_MAINNET);
    });

    it("should use public default when JSON empty and env var undefined", () => {
      const rpcConfig: RpcConfig = {};

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "solana-mainnet",
        envValue: undefined,
        publicDefault: PUBLIC_RPCS.SOLANA_MAINNET,
        type: "primary",
      });

      expect(result).toBe(PUBLIC_RPCS.SOLANA_MAINNET);
    });

    it("should handle fallback type correctly", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": {
          primary: "https://json-primary.example.com",
          fallback: "https://json-fallback.example.com",
        },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-fallback.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "fallback",
      });

      expect(result).toBe("https://json-fallback.example.com");
    });
  });

  describe("mixed configuration scenarios", () => {
    it("should handle partial JSON config with env var fallbacks", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { primary: "https://json-eth.example.com" },
        // solana-mainnet not in JSON
      };

      const ethResult = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-eth.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      const solanaResult = getRpcUrl({
        rpcConfig,
        jsonKey: "solana-mainnet",
        envValue: "https://env-solana.example.com",
        publicDefault: PUBLIC_RPCS.SOLANA_MAINNET,
        type: "primary",
      });

      expect(ethResult).toBe("https://json-eth.example.com");
      expect(solanaResult).toBe("https://env-solana.example.com");
    });

    it("should handle JSON with only primary, env var for fallback", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { primary: "https://json-primary.example.com" },
      };

      const primaryResult = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-primary.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      const fallbackResult = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env-fallback.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "fallback",
      });

      expect(primaryResult).toBe("https://json-primary.example.com");
      expect(fallbackResult).toBe("https://env-fallback.example.com");
    });

    it("should fall through all levels to public default", () => {
      const rpcConfig: RpcConfig = {};

      // No JSON config, no env var, should use public default
      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "tempo-testnet",
        envValue: undefined,
        publicDefault: PUBLIC_RPCS.TEMPO_TESTNET,
        type: "primary",
      });

      expect(result).toBe(PUBLIC_RPCS.TEMPO_TESTNET);
    });
  });

  describe("all chain keys", () => {
    const chainKeys = [
      { json: "eth-mainnet", public: PUBLIC_RPCS.ETH_MAINNET },
      { json: "sepolia", public: PUBLIC_RPCS.SEPOLIA },
      { json: "base-mainnet", public: PUBLIC_RPCS.BASE_MAINNET },
      { json: "base-sepolia", public: PUBLIC_RPCS.BASE_SEPOLIA },
      { json: "tempo-testnet", public: PUBLIC_RPCS.TEMPO_TESTNET },
      { json: "tempo-mainnet", public: PUBLIC_RPCS.TEMPO_MAINNET },
      { json: "solana-mainnet", public: PUBLIC_RPCS.SOLANA_MAINNET },
      { json: "solana-devnet", public: PUBLIC_RPCS.SOLANA_DEVNET },
    ];

    it.each(chainKeys)("should resolve $json from JSON config", ({
      json,
      public: publicDefault,
    }) => {
      const rpcConfig: RpcConfig = {
        [json]: { primary: `https://${json}.json.example.com` },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: json,
        envValue: undefined,
        publicDefault,
        type: "primary",
      });

      expect(result).toBe(`https://${json}.json.example.com`);
    });

    it.each(
      chainKeys
    )("should fall back to public default for $json when no config", ({
      json,
      public: publicDefault,
    }) => {
      const rpcConfig: RpcConfig = {};

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: json,
        envValue: undefined,
        publicDefault,
        type: "primary",
      });

      expect(result).toBe(publicDefault);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string in JSON config as falsy", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { primary: "" },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: "https://env.example.com",
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      // Empty string is falsy, should fall through to env var
      expect(result).toBe("https://env.example.com");
    });

    it("should handle null-ish values gracefully", () => {
      const rpcConfig: RpcConfig = {
        "eth-mainnet": { primary: undefined },
      };

      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "eth-mainnet",
        envValue: undefined,
        publicDefault: PUBLIC_RPCS.ETH_MAINNET,
        type: "primary",
      });

      expect(result).toBe(PUBLIC_RPCS.ETH_MAINNET);
    });

    it("should handle deeply nested undefined", () => {
      const rpcConfig: RpcConfig = {};

      // Accessing undefined chain then undefined type
      const result = getRpcUrl({
        rpcConfig,
        jsonKey: "nonexistent-chain",
        envValue: undefined,
        publicDefault: "https://default.example.com",
        type: "primary",
      });

      expect(result).toBe("https://default.example.com");
    });
  });

  describe("full integration simulation", () => {
    it("should resolve all chains from complete JSON config", () => {
      const fullConfig: RpcConfig = {
        "eth-mainnet": {
          primary: "https://eth.primary.com",
          fallback: "https://eth.fallback.com",
        },
        sepolia: {
          primary: "https://sepolia.primary.com",
          fallback: "https://sepolia.fallback.com",
        },
        "base-mainnet": {
          primary: "https://base.primary.com",
          fallback: "https://base.fallback.com",
        },
        "base-sepolia": {
          primary: "https://base-sep.primary.com",
          fallback: "https://base-sep.fallback.com",
        },
        "tempo-testnet": {
          primary: "https://tempo-test.primary.com",
          fallback: "https://tempo-test.fallback.com",
        },
        "tempo-mainnet": {
          primary: "https://tempo.primary.com",
          fallback: "https://tempo.fallback.com",
        },
        "solana-mainnet": {
          primary: "https://solana.primary.com",
          fallback: "https://solana.fallback.com",
        },
        "solana-devnet": {
          primary: "https://solana-dev.primary.com",
          fallback: "https://solana-dev.fallback.com",
        },
      };

      // Verify all chains resolve from JSON
      expect(
        getRpcUrl({
          rpcConfig: fullConfig,
          jsonKey: "eth-mainnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.ETH_MAINNET,
          type: "primary",
        })
      ).toBe("https://eth.primary.com");

      expect(
        getRpcUrl({
          rpcConfig: fullConfig,
          jsonKey: "solana-mainnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.SOLANA_MAINNET,
          type: "fallback",
        })
      ).toBe("https://solana.fallback.com");

      expect(
        getRpcUrl({
          rpcConfig: fullConfig,
          jsonKey: "tempo-testnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.TEMPO_TESTNET,
          type: "primary",
        })
      ).toBe("https://tempo-test.primary.com");
    });

    it("should work with realistic JSON string parsing", () => {
      const jsonString = JSON.stringify({
        "eth-mainnet": {
          primary: "https://chain.techops.services/eth-mainnet",
          fallback: "https://eth.llamarpc.com",
        },
        "solana-mainnet": {
          primary: "https://solana-mainnet.g.alchemy.com/v2/key123",
          fallback: "https://api.mainnet-beta.solana.com",
        },
      });

      const config = parseRpcConfig(jsonString);

      expect(
        getRpcUrl({
          rpcConfig: config,
          jsonKey: "eth-mainnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.ETH_MAINNET,
          type: "primary",
        })
      ).toBe("https://chain.techops.services/eth-mainnet");

      expect(
        getRpcUrl({
          rpcConfig: config,
          jsonKey: "solana-mainnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.SOLANA_MAINNET,
          type: "primary",
        })
      ).toBe("https://solana-mainnet.g.alchemy.com/v2/key123");

      // Chain not in JSON should use public default
      expect(
        getRpcUrl({
          rpcConfig: config,
          jsonKey: "tempo-testnet",
          envValue: undefined,
          publicDefault: PUBLIC_RPCS.TEMPO_TESTNET,
          type: "primary",
        })
      ).toBe(PUBLIC_RPCS.TEMPO_TESTNET);
    });
  });
});
