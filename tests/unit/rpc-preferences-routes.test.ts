/**
 * Unit tests for RPC Preferences API routes
 *
 * Tests the API route handlers with mocked auth and services
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth before imports
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock services before imports
vi.mock("@/lib/rpc/chain-service", () => ({
  getChainByChainId: vi.fn(),
}));

vi.mock("@/lib/rpc/config-service", () => ({
  deleteUserRpcPreference: vi.fn(),
  getUserRpcPreferences: vi.fn(),
  resolveAllRpcConfigs: vi.fn(),
  resolveRpcConfig: vi.fn(),
  setUserRpcPreference: vi.fn(),
}));

import {
  DELETE,
  GET as getSingleConfig,
  PUT,
} from "@/app/api/user/rpc-preferences/[chainId]/route";
import { GET as getAllPreferences } from "@/app/api/user/rpc-preferences/route";
import { auth } from "@/lib/auth";
import { getChainByChainId } from "@/lib/rpc/chain-service";
import {
  deleteUserRpcPreference,
  getUserRpcPreferences,
  resolveAllRpcConfigs,
  resolveRpcConfig,
  setUserRpcPreference,
} from "@/lib/rpc/config-service";

describe("RPC Preferences API Routes", () => {
  const mockUser = {
    id: "user_123",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    image: null,
    isAnonymous: false,
  };
  const mockSessionData = {
    id: "session_123",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    userId: "user_123",
    expiresAt: new Date("2026-12-31"),
    token: "mock_token",
    ipAddress: null,
    userAgent: null,
  };
  const mockSession = { session: mockSessionData, user: mockUser };

  const mockChain = {
    id: "chain_1",
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    chainType: "evm",
    defaultPrimaryRpc: "https://eth.example.com",
    defaultFallbackRpc: "https://eth-backup.example.com",
    defaultPrimaryWss: null,
    defaultFallbackWss: null,
    isEnabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    isTestnet: false,
    gasConfig: {},
  };

  const mockPreference = {
    id: "pref_1",
    userId: "user_123",
    chainId: 1,
    primaryRpcUrl: "https://custom-eth.example.com",
    fallbackRpcUrl: "https://custom-eth-backup.example.com",
    primaryWssUrl: null,
    fallbackWssUrl: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockResolvedConfig = {
    chainId: 1,
    chainName: "Ethereum Mainnet",
    primaryRpcUrl: "https://custom-eth.example.com",
    fallbackRpcUrl: "https://custom-eth-backup.example.com",
    source: "user" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock request
  const createRequest = (options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }) => {
    const { method = "GET", headers = {}, body } = options;
    return new Request("http://localhost:3000/api/test", {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  // Helper to create params promise (Next.js 15 style)
  const createParams = (chainId: string) => Promise.resolve({ chainId });

  describe("GET /api/user/rpc-preferences", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const request = createRequest({});
      const response = await getAllPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return preferences and resolved configs for authenticated user", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getUserRpcPreferences).mockResolvedValue([mockPreference]);
      vi.mocked(resolveAllRpcConfigs).mockResolvedValue([mockResolvedConfig]);

      const request = createRequest({});
      const response = await getAllPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toHaveLength(1);
      expect(data.preferences[0].chainId).toBe(1);
      expect(data.resolved).toHaveLength(1);
      expect(data.resolved[0].source).toBe("user");
    });

    it("should return empty arrays when user has no preferences", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getUserRpcPreferences).mockResolvedValue([]);
      vi.mocked(resolveAllRpcConfigs).mockResolvedValue([
        { ...mockResolvedConfig, source: "default" as const },
      ]);

      const request = createRequest({});
      const response = await getAllPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toHaveLength(0);
      expect(data.resolved[0].source).toBe("default");
    });
  });

  describe("GET /api/user/rpc-preferences/:chainId", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const request = createRequest({});
      const response = await getSingleConfig(request, {
        params: createParams("1"),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid chain ID", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);

      const request = createRequest({});
      const response = await getSingleConfig(request, {
        params: createParams("invalid"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid chain ID");
    });

    it("should return 404 when chain not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(resolveRpcConfig).mockResolvedValue(null);

      const request = createRequest({});
      const response = await getSingleConfig(request, {
        params: createParams("999"),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found or disabled");
    });

    it("should return resolved config with source field", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(resolveRpcConfig).mockResolvedValue(mockResolvedConfig);

      const request = createRequest({});
      const response = await getSingleConfig(request, {
        params: createParams("1"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chainId).toBe(1);
      expect(data.chainName).toBe("Ethereum Mainnet");
      expect(data.source).toBe("user");
      expect(resolveRpcConfig).toHaveBeenCalledWith(1, "user_123");
    });

    it("should return default source when no user preference", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(resolveRpcConfig).mockResolvedValue({
        ...mockResolvedConfig,
        primaryRpcUrl: "https://eth.example.com",
        source: "default",
      });

      const request = createRequest({});
      const response = await getSingleConfig(request, {
        params: createParams("1"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe("default");
    });
  });

  describe("PUT /api/user/rpc-preferences/:chainId", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const request = createRequest({
        method: "PUT",
        body: { primaryRpcUrl: "https://new-rpc.example.com" },
      });
      const response = await PUT(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid chain ID", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);

      const request = createRequest({
        method: "PUT",
        body: { primaryRpcUrl: "https://new-rpc.example.com" },
      });
      const response = await PUT(request, { params: createParams("invalid") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid chain ID");
    });

    it("should return 404 when chain not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getChainByChainId).mockResolvedValue(null);

      const request = createRequest({
        method: "PUT",
        body: { primaryRpcUrl: "https://new-rpc.example.com" },
      });
      const response = await PUT(request, { params: createParams("999") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });

    it("should return 400 when primaryRpcUrl is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getChainByChainId).mockResolvedValue(mockChain);

      const request = createRequest({
        method: "PUT",
        body: {},
      });
      const response = await PUT(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("primaryRpcUrl is required");
    });

    it("should return 400 for invalid URL format", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getChainByChainId).mockResolvedValue(mockChain);

      const request = createRequest({
        method: "PUT",
        body: { primaryRpcUrl: "not-a-valid-url" },
      });
      const response = await PUT(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RPC URL format");
    });

    it("should create preference successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getChainByChainId).mockResolvedValue(mockChain);
      vi.mocked(setUserRpcPreference).mockResolvedValue(mockPreference);

      const request = createRequest({
        method: "PUT",
        body: {
          primaryRpcUrl: "https://custom-eth.example.com",
          fallbackRpcUrl: "https://custom-eth-backup.example.com",
        },
      });
      const response = await PUT(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chainId).toBe(1);
      expect(data.primaryRpcUrl).toBe("https://custom-eth.example.com");
      expect(setUserRpcPreference).toHaveBeenCalledWith(
        "user_123",
        1,
        "https://custom-eth.example.com",
        "https://custom-eth-backup.example.com"
      );
    });

    it("should create preference without fallback URL", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getChainByChainId).mockResolvedValue(mockChain);
      vi.mocked(setUserRpcPreference).mockResolvedValue({
        ...mockPreference,
        fallbackRpcUrl: null,
      });

      const request = createRequest({
        method: "PUT",
        body: { primaryRpcUrl: "https://custom-eth.example.com" },
      });
      const response = await PUT(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fallbackRpcUrl).toBeNull();
    });
  });

  describe("DELETE /api/user/rpc-preferences/:chainId", () => {
    it("should return 401 when not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const request = createRequest({ method: "DELETE" });
      const response = await DELETE(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid chain ID", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);

      const request = createRequest({ method: "DELETE" });
      const response = await DELETE(request, {
        params: createParams("invalid"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid chain ID");
    });

    it("should return 404 when preference not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(deleteUserRpcPreference).mockResolvedValue(false);

      const request = createRequest({ method: "DELETE" });
      const response = await DELETE(request, { params: createParams("999") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("RPC preference not found");
    });

    it("should delete preference successfully", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(deleteUserRpcPreference).mockResolvedValue(true);

      const request = createRequest({ method: "DELETE" });
      const response = await DELETE(request, { params: createParams("1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(deleteUserRpcPreference).toHaveBeenCalledWith("user_123", 1);
    });
  });
});
