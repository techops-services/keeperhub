import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExplorerConfig } from "@/lib/db/schema";
import {
  fetchContractAbi,
  getAddressUrl,
  getContractUrl,
  getTransactionUrl,
} from "@/lib/explorer";
import { fetchBlockscoutAbi } from "@/lib/explorer/blockscout";
import { fetchEtherscanAbi } from "@/lib/explorer/etherscan";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("explorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Base mock explorer configs
  const baseEvmConfig: ExplorerConfig = {
    id: "explorer_1",
    chainId: 1,
    chainType: "evm",
    explorerUrl: "https://etherscan.io",
    explorerApiType: "etherscan",
    explorerApiUrl: "https://api.etherscan.io/v2/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}#code",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const blockscoutConfig: ExplorerConfig = {
    id: "explorer_2",
    chainId: 42_429,
    chainType: "evm",
    explorerUrl: "https://explorer.testnet.tempo.xyz",
    explorerApiType: "blockscout",
    explorerApiUrl: "https://explorer.testnet.tempo.xyz/api",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/address/{address}",
    explorerContractPath: "/address/{address}?tab=contract",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const solanaConfig: ExplorerConfig = {
    id: "explorer_3",
    chainId: 101,
    chainType: "solana",
    explorerUrl: "https://solscan.io",
    explorerApiType: "solscan",
    explorerApiUrl: "https://api.solscan.io",
    explorerTxPath: "/tx/{hash}",
    explorerAddressPath: "/account/{address}",
    explorerContractPath: "/account/{address}#anchorProgramIDL",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("getTransactionUrl", () => {
    it("should build transaction URL for EVM chain", () => {
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const url = getTransactionUrl(baseEvmConfig, txHash);

      expect(url).toBe(`https://etherscan.io/tx/${txHash}`);
    });

    it("should build transaction URL for Blockscout", () => {
      const txHash = "0xabc123";
      const url = getTransactionUrl(blockscoutConfig, txHash);

      expect(url).toBe(`https://explorer.testnet.tempo.xyz/tx/${txHash}`);
    });

    it("should build transaction URL for Solana", () => {
      const txHash = "5Yfx...signature";
      const url = getTransactionUrl(solanaConfig, txHash);

      expect(url).toBe(`https://solscan.io/tx/${txHash}`);
    });

    it("should return empty string when explorerUrl is null", () => {
      const config = { ...baseEvmConfig, explorerUrl: null };
      const url = getTransactionUrl(config, "0x123");

      expect(url).toBe("");
    });

    it("should use default path when explorerTxPath is null", () => {
      const config = { ...baseEvmConfig, explorerTxPath: null };
      const url = getTransactionUrl(config, "0x123");

      expect(url).toBe("https://etherscan.io/tx/0x123");
    });
  });

  describe("getAddressUrl", () => {
    it("should build address URL for EVM chain", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const url = getAddressUrl(baseEvmConfig, address);

      expect(url).toBe(`https://etherscan.io/address/${address}`);
    });

    it("should build address URL for Solana with /account path", () => {
      const address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      const url = getAddressUrl(solanaConfig, address);

      expect(url).toBe(`https://solscan.io/account/${address}`);
    });

    it("should return empty string when explorerUrl is null", () => {
      const config = { ...baseEvmConfig, explorerUrl: null };
      const url = getAddressUrl(config, "0x123");

      expect(url).toBe("");
    });

    it("should use default path when explorerAddressPath is null", () => {
      const config = { ...baseEvmConfig, explorerAddressPath: null };
      const url = getAddressUrl(config, "0x123");

      expect(url).toBe("https://etherscan.io/address/0x123");
    });
  });

  describe("getContractUrl", () => {
    it("should build contract URL for Etherscan with #code fragment", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const url = getContractUrl(baseEvmConfig, address);

      expect(url).toBe(`https://etherscan.io/address/${address}#code`);
    });

    it("should build contract URL for Blockscout with ?tab=contract query", () => {
      const address = "0xabc123";
      const url = getContractUrl(blockscoutConfig, address);

      expect(url).toBe(
        `https://explorer.testnet.tempo.xyz/address/${address}?tab=contract`
      );
    });

    it("should build contract URL for Solana with #anchorProgramIDL fragment", () => {
      const address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      const url = getContractUrl(solanaConfig, address);

      expect(url).toBe(
        `https://solscan.io/account/${address}#anchorProgramIDL`
      );
    });

    it("should return empty string when explorerUrl is null", () => {
      const config = { ...baseEvmConfig, explorerUrl: null };
      const url = getContractUrl(config, "0x123");

      expect(url).toBe("");
    });

    it("should fall back to /address/{address}#code for EVM when explorerContractPath is null", () => {
      const config = { ...baseEvmConfig, explorerContractPath: null };
      const url = getContractUrl(config, "0x123");

      expect(url).toBe("https://etherscan.io/address/0x123#code");
    });

    it("should fall back to /account/{address}#anchorProgramIDL for Solana when explorerContractPath is null", () => {
      const config = { ...solanaConfig, explorerContractPath: null };
      const url = getContractUrl(config, "0x123");

      expect(url).toBe("https://solscan.io/account/0x123#anchorProgramIDL");
    });
  });

  describe("fetchContractAbi dispatcher", () => {
    it("should return error when explorerApiUrl is null", async () => {
      const config = { ...baseEvmConfig, explorerApiUrl: null };
      const result = await fetchContractAbi(config, "0x123", 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Explorer API not configured for this chain");
    });

    it("should return error when explorerApiType is null", async () => {
      const config = { ...baseEvmConfig, explorerApiType: null };
      const result = await fetchContractAbi(config, "0x123", 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Explorer API not configured for this chain");
    });

    it("should return error for solscan type (IDL not supported)", async () => {
      const result = await fetchContractAbi(solanaConfig, "0x123", 101);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Solana IDL fetch not supported via API. Use Anchor CLI instead."
      );
    });

    it("should return error for unknown explorer type", async () => {
      const config = {
        ...baseEvmConfig,
        explorerApiType: "unknown",
      };
      const result = await fetchContractAbi(config, "0x123", 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown explorer type: unknown");
    });

    it("should call fetchEtherscanAbi for etherscan type", async () => {
      const mockAbi = [{ type: "function", name: "test" }];
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: JSON.stringify(mockAbi),
          }),
      });

      const result = await fetchContractAbi(
        baseEvmConfig,
        "0x123",
        1,
        "test-key"
      );

      expect(result.success).toBe(true);
      expect(result.abi).toEqual(mockAbi);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.etherscan.io/v2/api")
      );
    });

    it("should call fetchBlockscoutAbi for blockscout type", async () => {
      const mockAbi = [{ type: "function", name: "test" }];
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: JSON.stringify(mockAbi),
          }),
      });

      const result = await fetchContractAbi(blockscoutConfig, "0x123", 42_429);

      expect(result.success).toBe(true);
      expect(result.abi).toEqual(mockAbi);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://explorer.testnet.tempo.xyz/api")
      );
    });
  });

  describe("fetchEtherscanAbi", () => {
    const apiUrl = "https://api.etherscan.io/v2/api";
    const contractAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const chainId = 1;

    it("should return ABI on successful response", async () => {
      const mockAbi = [
        { type: "function", name: "transfer", inputs: [], outputs: [] },
      ];
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: JSON.stringify(mockAbi),
          }),
      });

      const result = await fetchEtherscanAbi(
        apiUrl,
        chainId,
        contractAddress,
        "test-key"
      );

      expect(result.success).toBe(true);
      expect(result.abi).toEqual(mockAbi);
    });

    it("should include chainid and apikey in request", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: "[]",
          }),
      });

      await fetchEtherscanAbi(apiUrl, chainId, contractAddress, "my-api-key");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("chainid=1");
      expect(calledUrl).toContain("apikey=my-api-key");
      expect(calledUrl).toContain("module=contract");
      expect(calledUrl).toContain("action=getabi");
      expect(calledUrl).toContain(`address=${contractAddress}`);
    });

    it("should not include apikey when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: "[]",
          }),
      });

      await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("apikey");
    });

    it("should return error for unverified contract", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Contract source code not verified",
          }),
      });

      const result = await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Contract source code is not verified on the block explorer"
      );
    });

    it("should return error for invalid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Invalid API Key",
          }),
      });

      const result = await fetchEtherscanAbi(
        apiUrl,
        chainId,
        contractAddress,
        "bad-key"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid Etherscan API key");
    });

    it("should return error for rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Rate limit exceeded",
          }),
      });

      const result = await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded. Please try again later.");
    });

    it("should return error for invalid address", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Invalid address format",
          }),
      });

      const result = await fetchEtherscanAbi(apiUrl, chainId, "invalid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid contract address");
    });

    it("should return error for network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should return error for JSON parse failure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: "not valid json",
          }),
      });

      const result = await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected token");
    });

    it("should return raw error message for unknown error", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Some random error from API",
          }),
      });

      const result = await fetchEtherscanAbi(apiUrl, chainId, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Some random error from API");
    });
  });

  describe("fetchBlockscoutAbi", () => {
    const apiUrl = "https://explorer.testnet.tempo.xyz/api";
    const contractAddress = "0x1234567890123456789012345678901234567890";

    it("should return ABI on successful response", async () => {
      const mockAbi = [
        { type: "function", name: "deposit", inputs: [], outputs: [] },
      ];
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: JSON.stringify(mockAbi),
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(true);
      expect(result.abi).toEqual(mockAbi);
    });

    it("should include correct parameters in request", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: "[]",
          }),
      });

      await fetchBlockscoutAbi(apiUrl, contractAddress);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("module=contract");
      expect(calledUrl).toContain("action=getabi");
      expect(calledUrl).toContain(`address=${contractAddress}`);
      // Blockscout doesn't use chainid or apikey
      expect(calledUrl).not.toContain("chainid");
      expect(calledUrl).not.toContain("apikey");
    });

    it("should return error for unverified contract", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Contract source code not verified",
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Contract source code is not verified on the block explorer"
      );
    });

    it("should return error for invalid address", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Invalid address",
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, "invalid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid contract address");
    });

    it("should return error for network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("should return error for JSON parse failure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "1",
            message: "OK",
            result: "{invalid json",
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Expected");
    });

    it("should return raw error message for unknown error", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "NOTOK",
            result: "Unknown Blockscout error",
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Blockscout error");
    });

    it("should return default error when result is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            status: "0",
            message: "",
            result: "",
          }),
      });

      const result = await fetchBlockscoutAbi(apiUrl, contractAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch ABI from Blockscout");
    });
  });
});
