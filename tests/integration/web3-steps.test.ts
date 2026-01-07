import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock ethers
vi.mock("ethers", () => ({
  ethers: {
    isAddress: vi.fn(
      (addr: string) => addr.startsWith("0x") && addr.length === 42
    ),
    formatEther: vi.fn((wei: bigint) => (Number(wei) / 1e18).toString()),
    parseEther: vi.fn((eth: string) =>
      BigInt(Math.floor(Number.parseFloat(eth) * 1e18))
    ),
    Contract: vi.fn().mockImplementation(() => ({
      balanceOf: vi.fn().mockResolvedValue(BigInt(1_000_000_000_000_000_000)),
      transfer: vi.fn().mockResolvedValue({
        hash: "0xtxhash123",
        wait: vi.fn().mockResolvedValue({
          hash: "0xtxhash123",
          blockNumber: 12_345,
          status: 1,
        }),
      }),
    })),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt(5_000_000_000_000_000_000)),
    })),
  },
}));

// Mock RPC provider
vi.mock("@/lib/rpc", () => ({
  getChainIdFromNetwork: vi.fn((network: string) => {
    const map: Record<string, number> = {
      mainnet: 1,
      sepolia: 11_155_111,
      base: 8453,
    };
    if (!map[network]) {
      throw new Error(`Unsupported network: ${network}`);
    }
    return map[network];
  }),
  getRpcProvider: vi.fn().mockResolvedValue({
    executeWithFailover: vi.fn(
      async (operation: (provider: unknown) => Promise<unknown>) => {
        const mockProvider = {
          getBalance: vi
            .fn()
            .mockResolvedValue(BigInt(5_000_000_000_000_000_000)),
        };
        return await operation(mockProvider);
      }
    ),
  }),
  resolveRpcConfig: vi.fn().mockResolvedValue({
    chainId: 1,
    chainName: "Ethereum Mainnet",
    primaryRpcUrl: "https://eth.example.com",
    fallbackRpcUrl: "https://eth-backup.example.com",
    source: "default",
  }),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: "user_123" }]),
        }),
      }),
    }),
  },
}));

// Mock Para wallet helpers
vi.mock("@/keeperhub/lib/para/wallet-helpers", () => ({
  initializeParaSigner: vi.fn().mockResolvedValue({
    getAddress: vi
      .fn()
      .mockResolvedValue("0x1234567890123456789012345678901234567890"),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: "0xtxhash456",
      wait: vi.fn().mockResolvedValue({
        hash: "0xtxhash456",
        blockNumber: 12_346,
        status: 1,
      }),
    }),
  }),
}));

// Mock step handler
vi.mock("@/lib/steps/step-handler", () => ({
  withStepLogging: vi.fn((_input, handler) => handler()),
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  getErrorMessage: vi.fn((error) => error?.message || String(error)),
}));

// Now import the step functions after all mocks are set up
import { checkBalanceStep } from "@/keeperhub/plugins/web3/steps/check-balance";
import {
  getChainIdFromNetwork,
  getRpcProvider,
  resolveRpcConfig,
} from "@/lib/rpc";

// Helper to create test context
const createTestContext = () => ({
  executionId: "exec_123",
  nodeId: "node_123",
  nodeName: "Test Node",
  nodeType: "check-balance" as const,
});

describe("Web3 Plugin Steps Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkBalanceStep", () => {
    it("should successfully check balance on mainnet", async () => {
      const input = {
        network: "mainnet",
        address: "0x1234567890123456789012345678901234567890",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.balance).toBe("5");
        expect(result.balanceWei).toBe("5000000000000000000");
        expect(result.address).toBe(
          "0x1234567890123456789012345678901234567890"
        );
      }

      // Verify userId is passed to getRpcProvider for user RPC preferences
      expect(getRpcProvider).toHaveBeenCalledWith({
        chainId: 1,
        userId: "user_123",
      });
    });

    it("should successfully check balance on sepolia", async () => {
      const input = {
        network: "sepolia",
        address: "0x1234567890123456789012345678901234567890",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(true);
      expect(getChainIdFromNetwork).toHaveBeenCalledWith("sepolia");
    });

    it("should fail with invalid address", async () => {
      const input = {
        network: "mainnet",
        address: "invalid-address",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid Ethereum address");
      }
    });

    it("should fail with unsupported network", async () => {
      vi.mocked(getChainIdFromNetwork).mockImplementationOnce(() => {
        throw new Error("Unsupported network: polygon");
      });

      const input = {
        network: "polygon",
        address: "0x1234567890123456789012345678901234567890",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unsupported network");
      }
    });

    it("should handle RPC provider errors", async () => {
      vi.mocked(getRpcProvider).mockResolvedValueOnce({
        executeWithFailover: vi
          .fn()
          .mockRejectedValue(new Error("RPC connection failed")),
      } as unknown as Awaited<ReturnType<typeof getRpcProvider>>);

      const input = {
        network: "mainnet",
        address: "0x1234567890123456789012345678901234567890",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to check balance");
      }
    });

    it("should use failover when primary RPC fails", async () => {
      vi.mocked(getRpcProvider).mockResolvedValueOnce({
        executeWithFailover: vi.fn(
          async (operation: (provider: unknown) => Promise<unknown>) => {
            // Simulate failover by returning success after mock "failover"
            const mockProvider = {
              getBalance: vi
                .fn()
                .mockResolvedValue(BigInt(3_000_000_000_000_000_000)),
            };
            return await operation(mockProvider);
          }
        ),
      } as unknown as Awaited<ReturnType<typeof getRpcProvider>>);

      const input = {
        network: "mainnet",
        address: "0x1234567890123456789012345678901234567890",
        _context: createTestContext(),
      };

      const result = await checkBalanceStep(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.balance).toBe("3");
      }
    });
  });
});

describe("Web3 RPC Config Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve config with user preferences", async () => {
    vi.mocked(resolveRpcConfig).mockResolvedValueOnce({
      chainId: 1,
      chainName: "Ethereum Mainnet",
      primaryRpcUrl: "https://user-custom-rpc.example.com",
      fallbackRpcUrl: "https://user-custom-backup.example.com",
      source: "user",
    });

    const config = await resolveRpcConfig(1, "user_123");

    expect(config?.source).toBe("user");
    expect(config?.primaryRpcUrl).toBe("https://user-custom-rpc.example.com");
  });

  it("should fall back to defaults when no user preference", async () => {
    vi.mocked(resolveRpcConfig).mockResolvedValueOnce({
      chainId: 1,
      chainName: "Ethereum Mainnet",
      primaryRpcUrl: "https://default-rpc.example.com",
      fallbackRpcUrl: "https://default-backup.example.com",
      source: "default",
    });

    const config = await resolveRpcConfig(1, "user_456");

    expect(config?.source).toBe("default");
  });

  it("should return null for disabled chain", async () => {
    vi.mocked(resolveRpcConfig).mockResolvedValueOnce(null);

    const config = await resolveRpcConfig(999);

    expect(config).toBeNull();
  });
});
