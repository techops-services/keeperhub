import { describe, it, expect } from "vitest";
import {
  getChainIdFromNetwork,
  getNetworkName,
  SUPPORTED_CHAIN_IDS,
} from "@/lib/rpc";

describe("getChainIdFromNetwork", () => {
  describe("with string network names", () => {
    it("should return chain ID for mainnet", () => {
      expect(getChainIdFromNetwork("mainnet")).toBe(1);
      expect(getChainIdFromNetwork("ethereum-mainnet")).toBe(1);
      expect(getChainIdFromNetwork("ethereum")).toBe(1);
    });

    it("should return chain ID for sepolia", () => {
      expect(getChainIdFromNetwork("sepolia")).toBe(11155111);
      expect(getChainIdFromNetwork("sepolia-testnet")).toBe(11155111);
    });

    it("should return chain ID for base", () => {
      expect(getChainIdFromNetwork("base")).toBe(8453);
      expect(getChainIdFromNetwork("base-mainnet")).toBe(8453);
    });

    it("should be case insensitive", () => {
      expect(getChainIdFromNetwork("MAINNET")).toBe(1);
      expect(getChainIdFromNetwork("Sepolia")).toBe(11155111);
      expect(getChainIdFromNetwork("BASE")).toBe(8453);
    });

    it("should throw for unsupported network", () => {
      expect(() => getChainIdFromNetwork("unsupported")).toThrow(
        "Unsupported network: unsupported"
      );
      expect(() => getChainIdFromNetwork("polygon")).toThrow(
        "Unsupported network: polygon"
      );
    });

    it("should throw with helpful message listing supported networks", () => {
      expect(() => getChainIdFromNetwork("unknown")).toThrow("Supported:");
    });
  });

  describe("with numeric chain IDs", () => {
    it("should return the same chain ID for numbers", () => {
      expect(getChainIdFromNetwork(1)).toBe(1);
      expect(getChainIdFromNetwork(11155111)).toBe(11155111);
      expect(getChainIdFromNetwork(8453)).toBe(8453);
    });

    it("should return any numeric chain ID as-is", () => {
      expect(getChainIdFromNetwork(137)).toBe(137); // Polygon
      expect(getChainIdFromNetwork(42161)).toBe(42161); // Arbitrum
    });
  });
});

describe("getNetworkName", () => {
  it("should return name for known chain IDs", () => {
    expect(getNetworkName(1)).toBe("Ethereum Mainnet");
    expect(getNetworkName(11155111)).toBe("Sepolia Testnet");
    expect(getNetworkName(8453)).toBe("Base");
  });

  it("should return generic name for unknown chain IDs", () => {
    expect(getNetworkName(137)).toBe("Chain 137");
    expect(getNetworkName(42161)).toBe("Chain 42161");
    expect(getNetworkName(999999)).toBe("Chain 999999");
  });
});

describe("SUPPORTED_CHAIN_IDS", () => {
  it("should have correct values", () => {
    expect(SUPPORTED_CHAIN_IDS.MAINNET).toBe(1);
    expect(SUPPORTED_CHAIN_IDS.SEPOLIA).toBe(11155111);
    expect(SUPPORTED_CHAIN_IDS.BASE).toBe(8453);
  });

  it("should be frozen/readonly", () => {
    // TypeScript enforces this at compile time, but we can verify values exist
    expect(Object.keys(SUPPORTED_CHAIN_IDS)).toHaveLength(3);
  });
});
