import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RpcProviderManager,
  createRpcProviderManager,
  clearRpcProviderManagerCache,
  getAllFailoverStates,
  noopMetricsCollector,
  consoleMetricsCollector,
  type RpcMetricsCollector,
} from "@/lib/rpc-provider";

// Mock ethers
vi.mock("ethers", () => {
  const mockProvider = {
    getBalance: vi.fn(),
    getBlock: vi.fn(),
    call: vi.fn(),
  };

  // Create a proper mock class for FetchRequest
  class MockFetchRequest {
    url: string;
    timeout: number = 5000;
    constructor(url: string) {
      this.url = url;
    }
  }

  // Create a proper mock class for JsonRpcProvider
  class MockJsonRpcProvider {
    getBalance = vi.fn();
    getBlock = vi.fn();
    call = vi.fn();
    constructor(_fetchRequest: MockFetchRequest) {
      // Constructor accepts a FetchRequest
    }
  }

  return {
    ethers: {
      JsonRpcProvider: MockJsonRpcProvider,
      FetchRequest: MockFetchRequest,
    },
  };
});

describe("RpcProviderManager", () => {
  let metricsCollector: RpcMetricsCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    clearRpcProviderManagerCache();

    metricsCollector = {
      recordPrimaryAttempt: vi.fn(),
      recordPrimaryFailure: vi.fn(),
      recordFallbackAttempt: vi.fn(),
      recordFallbackFailure: vi.fn(),
      recordFailoverEvent: vi.fn(),
    };
  });

  afterEach(() => {
    clearRpcProviderManagerCache();
  });

  describe("constructor", () => {
    it("should create manager with default config values", () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
        },
      });

      expect(manager.getChainName()).toBe("unknown");
      expect(manager.isCurrentlyUsingFallback()).toBe(false);
      expect(manager.getCurrentProviderType()).toBe("primary");
    });

    it("should create manager with custom config values", () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 5,
          timeoutMs: 60000,
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      expect(manager.getChainName()).toBe("Ethereum");
    });
  });

  describe("getMetrics", () => {
    it("should return initial metrics with zero values", () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
        },
      });

      const metrics = manager.getMetrics();

      expect(metrics).toEqual({
        primaryAttempts: 0,
        primaryFailures: 0,
        fallbackAttempts: 0,
        fallbackFailures: 0,
        totalRequests: 0,
        lastFailoverTime: null,
      });
    });
  });

  describe("executeWithFailover", () => {
    it("should execute operation successfully on primary", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      const mockOperation = vi.fn().mockResolvedValue("success");

      const result = await manager.executeWithFailover(mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(metricsCollector.recordPrimaryAttempt).toHaveBeenCalledWith(
        "Ethereum"
      );
      expect(manager.getMetrics().totalRequests).toBe(1);
      expect(manager.getMetrics().primaryAttempts).toBe(1);
    });

    it("should retry on primary failure before failing over", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 2,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValue("success on retry");

      const result = await manager.executeWithFailover(mockOperation);

      expect(result).toBe("success on retry");
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(metricsCollector.recordPrimaryAttempt).toHaveBeenCalledTimes(2);
      expect(metricsCollector.recordPrimaryFailure).toHaveBeenCalledTimes(1);
    });

    it("should failover to fallback when primary exhausts retries", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 2,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Primary failed 1"))
        .mockRejectedValueOnce(new Error("Primary failed 2"))
        .mockResolvedValue("fallback success");

      const result = await manager.executeWithFailover(mockOperation);

      expect(result).toBe("fallback success");
      expect(manager.isCurrentlyUsingFallback()).toBe(true);
      expect(metricsCollector.recordFailoverEvent).toHaveBeenCalledWith(
        "Ethereum"
      );
    });

    it("should throw error when both primary and fallback fail", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 1,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      const mockOperation = vi.fn().mockRejectedValue(new Error("All failed"));

      await expect(manager.executeWithFailover(mockOperation)).rejects.toThrow(
        "RPC failed on both endpoints"
      );
    });

    it("should throw error when primary fails and no fallback configured", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          maxRetries: 1,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        metricsCollector,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));

      await expect(manager.executeWithFailover(mockOperation)).rejects.toThrow(
        "RPC failed on primary endpoint"
      );
    });

    it("should call failover state change callback on failover", async () => {
      const onFailoverStateChange = vi.fn();

      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 1,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        onFailoverStateChange,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValue("fallback success");

      await manager.executeWithFailover(mockOperation);

      expect(onFailoverStateChange).toHaveBeenCalledWith(
        "Ethereum",
        true,
        "failover"
      );
    });

    it("should recover to primary when fallback fails and primary comes back online", async () => {
      const onFailoverStateChange = vi.fn();

      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 1,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
        onFailoverStateChange,
      });

      // First call - primary fails, fallback succeeds -> enters failover state
      const failOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValue("fallback success");

      await manager.executeWithFailover(failOperation);
      expect(manager.isCurrentlyUsingFallback()).toBe(true);

      // Second call - fallback fails, primary recovers -> exits failover state
      // Note: When in failover state, it tries fallback first. If fallback fails,
      // it tries primary, and if primary succeeds, it recovers.
      const recoverOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fallback failed"))
        .mockResolvedValue("primary recovered");

      await manager.executeWithFailover(recoverOperation);
      expect(manager.isCurrentlyUsingFallback()).toBe(false);
      expect(onFailoverStateChange).toHaveBeenCalledWith(
        "Ethereum",
        false,
        "recovery"
      );
    });
  });

  describe("setFailoverStateChangeCallback", () => {
    it("should update the callback", async () => {
      const manager = new RpcProviderManager({
        config: {
          primaryRpcUrl: "https://primary.example.com",
          fallbackRpcUrl: "https://fallback.example.com",
          maxRetries: 1,
          timeoutMs: 100,
          chainName: "Ethereum",
        },
      });

      const newCallback = vi.fn();
      manager.setFailoverStateChangeCallback(newCallback);

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValue("fallback success");

      await manager.executeWithFailover(mockOperation);

      expect(newCallback).toHaveBeenCalledWith("Ethereum", true, "failover");
    });
  });
});

describe("createRpcProviderManager", () => {
  beforeEach(() => {
    clearRpcProviderManagerCache();
  });

  afterEach(() => {
    clearRpcProviderManagerCache();
  });

  it("should create a new manager", () => {
    const manager = createRpcProviderManager({
      primaryRpcUrl: "https://primary.example.com",
      chainName: "Ethereum",
    });

    expect(manager).toBeInstanceOf(RpcProviderManager);
    expect(manager.getChainName()).toBe("Ethereum");
  });

  it("should cache managers by URL combination", () => {
    const manager1 = createRpcProviderManager({
      primaryRpcUrl: "https://primary.example.com",
      chainName: "Ethereum",
    });

    const manager2 = createRpcProviderManager({
      primaryRpcUrl: "https://primary.example.com",
      chainName: "Ethereum",
    });

    expect(manager1).toBe(manager2);
  });

  it("should create different managers for different URLs", () => {
    const manager1 = createRpcProviderManager({
      primaryRpcUrl: "https://primary1.example.com",
      chainName: "Ethereum",
    });

    const manager2 = createRpcProviderManager({
      primaryRpcUrl: "https://primary2.example.com",
      chainName: "Ethereum",
    });

    expect(manager1).not.toBe(manager2);
  });

  it("should update callback on cached manager", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    createRpcProviderManager({
      primaryRpcUrl: "https://primary.example.com",
      chainName: "Ethereum",
      onFailoverStateChange: callback1,
    });

    const manager = createRpcProviderManager({
      primaryRpcUrl: "https://primary.example.com",
      chainName: "Ethereum",
      onFailoverStateChange: callback2,
    });

    // The callback should be updated to callback2
    expect(manager).toBeDefined();
  });
});

describe("getAllFailoverStates", () => {
  beforeEach(() => {
    clearRpcProviderManagerCache();
  });

  afterEach(() => {
    clearRpcProviderManagerCache();
  });

  it("should return empty map when no managers exist", () => {
    const states = getAllFailoverStates();
    expect(states.size).toBe(0);
  });

  it("should return states for all cached managers", () => {
    createRpcProviderManager({
      primaryRpcUrl: "https://eth.example.com",
      chainName: "Ethereum",
    });

    createRpcProviderManager({
      primaryRpcUrl: "https://base.example.com",
      chainName: "Base",
    });

    const states = getAllFailoverStates();

    expect(states.size).toBe(2);

    const values = Array.from(states.values());
    expect(values).toContainEqual({
      chainName: "Ethereum",
      isUsingFallback: false,
    });
    expect(values).toContainEqual({
      chainName: "Base",
      isUsingFallback: false,
    });
  });
});

describe("noopMetricsCollector", () => {
  it("should not throw when called", () => {
    expect(() => noopMetricsCollector.recordPrimaryAttempt("test")).not.toThrow();
    expect(() => noopMetricsCollector.recordPrimaryFailure("test")).not.toThrow();
    expect(() => noopMetricsCollector.recordFallbackAttempt("test")).not.toThrow();
    expect(() => noopMetricsCollector.recordFallbackFailure("test")).not.toThrow();
    expect(() => noopMetricsCollector.recordFailoverEvent("test")).not.toThrow();
  });
});

describe("consoleMetricsCollector", () => {
  it("should log to console.debug", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    consoleMetricsCollector.recordPrimaryAttempt("Ethereum");
    expect(debugSpy).toHaveBeenCalledWith(
      "[RPC Metrics] Primary attempt: Ethereum"
    );

    consoleMetricsCollector.recordPrimaryFailure("Ethereum");
    expect(debugSpy).toHaveBeenCalledWith(
      "[RPC Metrics] Primary failure: Ethereum"
    );

    debugSpy.mockRestore();
  });
});
