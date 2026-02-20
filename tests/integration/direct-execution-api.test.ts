import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks -- available to vi.mock factories which run before any imports
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  checkRateLimit: vi.fn(),
  checkSpendingCap: vi.fn(),
  createExecution: vi.fn(),
  markRunning: vi.fn(),
  completeExecution: vi.fn(),
  failExecution: vi.fn(),
  redactInput: vi.fn(),
  transferFundsCore: vi.fn(),
  transferTokenCore: vi.fn(),
  readContractCore: vi.fn(),
  writeContractCore: vi.fn(),
  resolveAbi: vi.fn(),
  statusDbResult: [] as unknown[],
}));

vi.mock("server-only", () => ({}));

vi.mock("@/keeperhub/api/execute/_lib/auth", () => ({
  validateApiKey: mocks.validateApiKey,
}));

vi.mock("@/keeperhub/api/execute/_lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/keeperhub/api/execute/_lib/spending-cap", () => ({
  checkSpendingCap: mocks.checkSpendingCap,
}));

vi.mock("@/keeperhub/api/execute/_lib/execution-service", () => ({
  createExecution: mocks.createExecution,
  markRunning: mocks.markRunning,
  completeExecution: mocks.completeExecution,
  failExecution: mocks.failExecution,
  redactInput: mocks.redactInput,
}));

vi.mock("@/keeperhub/plugins/web3/steps/transfer-funds-core", () => ({
  transferFundsCore: mocks.transferFundsCore,
}));

vi.mock("@/keeperhub/plugins/web3/steps/transfer-token-core", () => ({
  transferTokenCore: mocks.transferTokenCore,
}));

vi.mock("@/keeperhub/plugins/web3/steps/read-contract-core", () => ({
  readContractCore: mocks.readContractCore,
}));

vi.mock("@/keeperhub/plugins/web3/steps/write-contract-core", () => ({
  writeContractCore: mocks.writeContractCore,
}));

vi.mock("@/keeperhub/lib/abi-cache", () => ({
  resolveAbi: mocks.resolveAbi,
}));

vi.mock("@/lib/utils", () => ({
  getErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
}));

// DB mock -- override global setup mock to support .limit() for the status route
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mocks.statusDbResult)),
        })),
      })),
    })),
    query: {
      workflows: { findFirst: vi.fn(), findMany: vi.fn() },
      workflowSchedules: { findFirst: vi.fn(), findMany: vi.fn() },
      workflowExecutions: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn() })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn() })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { GET as statusGET } from "@/keeperhub/api/execute/[executionId]/status/route";
import { POST as checkAndExecutePOST } from "@/keeperhub/api/execute/check-and-execute/route";
import { POST as contractCallPOST } from "@/keeperhub/api/execute/contract-call/route";
import { POST as swapPOST } from "@/keeperhub/api/execute/swap/route";
import { POST as transferPOST } from "@/keeperhub/api/execute/transfer/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = { organizationId: "org_test", apiKeyId: "key_test" };
const AUTH_HEADER = { Authorization: "Bearer kh_test123" };

const VIEW_ABI = JSON.stringify([
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
]);

const WRITE_ABI = JSON.stringify([
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/execute${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(path: string): Request {
  return new Request(`http://localhost:3000/api/execute${path}`, {
    method: "GET",
    headers: { ...AUTH_HEADER },
  });
}

function setupPassingGuards(): void {
  mocks.validateApiKey.mockResolvedValue(AUTH_CONTEXT);
  mocks.checkRateLimit.mockReturnValue({ allowed: true });
  mocks.checkSpendingCap.mockResolvedValue({ allowed: true });
  mocks.redactInput.mockImplementation(
    (input: Record<string, unknown>) => input
  );
  mocks.createExecution.mockResolvedValue({ executionId: "exec_1" });
  mocks.markRunning.mockResolvedValue(undefined);
  mocks.completeExecution.mockResolvedValue(undefined);
  mocks.failExecution.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Direct Execution API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.statusDbResult = [];
  });

  // ==========================================================================
  // POST /api/execute/transfer
  // ==========================================================================
  describe("POST /api/execute/transfer", () => {
    const validBody = {
      network: "ethereum",
      recipientAddress: "0x1234567890123456789012345678901234567890",
      amount: "1.0",
    };

    it("returns 401 when auth fails", async () => {
      mocks.validateApiKey.mockResolvedValue(null);

      const response = await transferPOST(postRequest("/transfer", validBody));

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 429 when rate limited with Retry-After header", async () => {
      mocks.validateApiKey.mockResolvedValue(AUTH_CONTEXT);
      mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfter: 30 });

      const response = await transferPOST(postRequest("/transfer", validBody));

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
      const data = await response.json();
      expect(data.error).toBe("Rate limit exceeded");
    });

    it("returns 400 for invalid JSON body", async () => {
      mocks.validateApiKey.mockResolvedValue(AUTH_CONTEXT);
      mocks.checkRateLimit.mockReturnValue({ allowed: true });

      const request = new Request(
        "http://localhost:3000/api/execute/transfer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...AUTH_HEADER },
          body: "not json",
        }
      );

      const response = await transferPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid JSON body");
    });

    it("returns 400 when required fields missing", async () => {
      mocks.validateApiKey.mockResolvedValue(AUTH_CONTEXT);
      mocks.checkRateLimit.mockReturnValue({ allowed: true });

      const response = await transferPOST(
        postRequest("/transfer", { network: "ethereum" })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Missing required field");
      expect(data.field).toBe("recipientAddress");
    });

    it("returns 403 when spending cap exceeded", async () => {
      setupPassingGuards();
      mocks.checkSpendingCap.mockResolvedValue({
        allowed: false,
        reason: "Daily spending cap exceeded",
      });

      const response = await transferPOST(postRequest("/transfer", validBody));

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Daily spending cap exceeded");
    });

    it("returns 202 for successful ETH transfer", async () => {
      setupPassingGuards();
      mocks.transferFundsCore.mockResolvedValue({
        success: true,
        transactionHash: "0xabc",
        transactionLink: "https://etherscan.io/tx/0xabc",
      });

      const response = await transferPOST(postRequest("/transfer", validBody));

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.executionId).toBe("exec_1");
      expect(data.status).toBe("completed");
      expect(mocks.completeExecution).toHaveBeenCalledOnce();
      expect(mocks.transferFundsCore).toHaveBeenCalledWith(
        expect.objectContaining({
          network: "ethereum",
          recipientAddress: validBody.recipientAddress,
          amount: "1.0",
        })
      );
    });

    it("returns 202 for ERC-20 token transfer", async () => {
      setupPassingGuards();
      mocks.transferTokenCore.mockResolvedValue({
        success: true,
        transactionHash: "0xdef",
        transactionLink: "https://etherscan.io/tx/0xdef",
      });

      const bodyWithToken = {
        ...validBody,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      };

      const response = await transferPOST(
        postRequest("/transfer", bodyWithToken)
      );

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.status).toBe("completed");
      expect(mocks.transferTokenCore).toHaveBeenCalledOnce();
      expect(mocks.transferFundsCore).not.toHaveBeenCalled();
    });

    it("returns 202 with failed status when transfer fails", async () => {
      setupPassingGuards();
      mocks.transferFundsCore.mockResolvedValue({
        success: false,
        error: "Insufficient funds",
      });

      const response = await transferPOST(postRequest("/transfer", validBody));

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.status).toBe("failed");
      expect(mocks.failExecution).toHaveBeenCalledWith(
        "exec_1",
        "Insufficient funds"
      );
    });
  });

  // ==========================================================================
  // POST /api/execute/contract-call
  // ==========================================================================
  describe("POST /api/execute/contract-call", () => {
    const validReadBody = {
      contractAddress: "0x1234567890123456789012345678901234567890",
      network: "ethereum",
      functionName: "balanceOf",
      abi: VIEW_ABI,
      functionArgs: JSON.stringify(["0xabc"]),
    };

    const validWriteBody = {
      contractAddress: "0x1234567890123456789012345678901234567890",
      network: "ethereum",
      functionName: "transfer",
      abi: WRITE_ABI,
      functionArgs: JSON.stringify(["0xabc", "1000000"]),
    };

    it("returns 401 when auth fails", async () => {
      mocks.validateApiKey.mockResolvedValue(null);

      const response = await contractCallPOST(
        postRequest("/contract-call", validReadBody)
      );

      expect(response.status).toBe(401);
    });

    it("returns 400 when required fields missing", async () => {
      setupPassingGuards();

      const response = await contractCallPOST(
        postRequest("/contract-call", { network: "ethereum" })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("contractAddress");
    });

    it("returns 400 when ABI resolution fails", async () => {
      setupPassingGuards();
      mocks.resolveAbi.mockRejectedValue(new Error("Explorer returned 404"));

      const bodyNoAbi = {
        contractAddress: "0x1234567890123456789012345678901234567890",
        network: "ethereum",
        functionName: "balanceOf",
      };

      const response = await contractCallPOST(
        postRequest("/contract-call", bodyNoAbi)
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("abi");
      expect(data.error).toContain("Could not auto-fetch ABI");
    });

    it("returns 400 when function not found in ABI", async () => {
      setupPassingGuards();

      const body = { ...validReadBody, functionName: "nonExistent" };

      const response = await contractCallPOST(
        postRequest("/contract-call", body)
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("functionName");
      expect(data.error).toContain("not found in ABI");
    });

    it("returns 200 with result for view/pure call", async () => {
      setupPassingGuards();
      mocks.readContractCore.mockResolvedValue({
        success: true,
        result: "1000000",
      });

      const response = await contractCallPOST(
        postRequest("/contract-call", validReadBody)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toBe("1000000");
      expect(mocks.createExecution).not.toHaveBeenCalled();
    });

    it("returns 202 for write call with execution record", async () => {
      setupPassingGuards();
      mocks.writeContractCore.mockResolvedValue({
        success: true,
        transactionHash: "0xwrite",
        transactionLink: "https://etherscan.io/tx/0xwrite",
      });

      const response = await contractCallPOST(
        postRequest("/contract-call", validWriteBody)
      );

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.executionId).toBe("exec_1");
      expect(data.status).toBe("completed");
      expect(mocks.createExecution).toHaveBeenCalledOnce();
    });

    it("returns 403 when spending cap exceeded for write call", async () => {
      setupPassingGuards();
      mocks.checkSpendingCap.mockResolvedValue({
        allowed: false,
        reason: "Daily spending cap exceeded",
      });

      const response = await contractCallPOST(
        postRequest("/contract-call", validWriteBody)
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Daily spending cap exceeded");
    });
  });

  // ==========================================================================
  // POST /api/execute/check-and-execute
  // ==========================================================================
  describe("POST /api/execute/check-and-execute", () => {
    const validBody = {
      contractAddress: "0x1234567890123456789012345678901234567890",
      network: "ethereum",
      functionName: "balanceOf",
      abi: VIEW_ABI,
      functionArgs: JSON.stringify(["0xabc"]),
      condition: { operator: "gt", value: "1000" },
      action: {
        contractAddress: "0x1234567890123456789012345678901234567890",
        functionName: "transfer",
        abi: WRITE_ABI,
        functionArgs: JSON.stringify(["0xabc", "500"]),
      },
    };

    it("returns 401 when auth fails", async () => {
      mocks.validateApiKey.mockResolvedValue(null);

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", validBody)
      );

      expect(response.status).toBe(401);
    });

    it("returns 400 when condition missing", async () => {
      setupPassingGuards();

      const { condition: _, ...bodyWithoutCondition } = validBody;

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", bodyWithoutCondition)
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("condition");
    });

    it("returns 400 when action missing", async () => {
      setupPassingGuards();

      const { action: _, ...bodyWithoutAction } = validBody;

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", bodyWithoutAction)
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("action");
    });

    it("returns 400 for invalid condition operator", async () => {
      setupPassingGuards();

      const body = {
        ...validBody,
        condition: { operator: "between", value: "1000" },
      };

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", body)
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.field).toBe("condition.operator");
    });

    it("returns 200 with executed=false when condition not met", async () => {
      setupPassingGuards();
      mocks.readContractCore.mockResolvedValue({
        success: true,
        result: "500",
      });

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", validBody)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.executed).toBe(false);
      expect(data.conditionResult.met).toBe(false);
      expect(data.conditionResult.observedValue).toBe("500");
      expect(mocks.writeContractCore).not.toHaveBeenCalled();
    });

    it("returns 202 with executed=true when condition met and write succeeds", async () => {
      setupPassingGuards();
      mocks.readContractCore.mockResolvedValue({
        success: true,
        result: "1500",
      });
      mocks.writeContractCore.mockResolvedValue({
        success: true,
        transactionHash: "0xcond",
        transactionLink: "https://etherscan.io/tx/0xcond",
      });

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", validBody)
      );

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.executed).toBe(true);
      expect(data.conditionResult.met).toBe(true);
      expect(data.executionId).toBe("exec_1");
    });

    it("returns 403 when condition met but spending cap exceeded", async () => {
      setupPassingGuards();
      mocks.readContractCore.mockResolvedValue({
        success: true,
        result: "1500",
      });
      mocks.checkSpendingCap.mockResolvedValue({
        allowed: false,
        reason: "Daily spending cap exceeded",
      });

      const response = await checkAndExecutePOST(
        postRequest("/check-and-execute", validBody)
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Daily spending cap exceeded");
    });
  });

  // ==========================================================================
  // GET /api/execute/{id}/status
  // ==========================================================================
  describe("GET /api/execute/{id}/status", () => {
    it("returns 401 when auth fails", async () => {
      mocks.validateApiKey.mockResolvedValue(null);

      const response = await statusGET(getRequest("/exec_1/status"), {
        params: Promise.resolve({ executionId: "exec_1" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 when execution not found", async () => {
      setupPassingGuards();
      mocks.statusDbResult = [];

      const response = await statusGET(getRequest("/exec_missing/status"), {
        params: Promise.resolve({ executionId: "exec_missing" }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Execution not found");
    });

    it("returns 200 with full execution details", async () => {
      setupPassingGuards();
      const now = new Date();
      mocks.statusDbResult = [
        {
          id: "exec_1",
          organizationId: "org_test",
          apiKeyId: "key_test",
          type: "transfer",
          network: "ethereum",
          status: "completed",
          transactionHash: "0xabc",
          gasUsedWei: "21000",
          input: {},
          output: { transactionLink: "https://etherscan.io/tx/0xabc" },
          error: null,
          createdAt: now,
          completedAt: now,
        },
      ];

      const response = await statusGET(getRequest("/exec_1/status"), {
        params: Promise.resolve({ executionId: "exec_1" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.executionId).toBe("exec_1");
      expect(data.status).toBe("completed");
      expect(data.type).toBe("transfer");
      expect(data.transactionHash).toBe("0xabc");
      expect(data.transactionLink).toBe("https://etherscan.io/tx/0xabc");
      expect(data.createdAt).toBe(now.toISOString());
      expect(data.completedAt).toBe(now.toISOString());
    });
  });

  // ==========================================================================
  // POST /api/execute/swap
  // ==========================================================================
  describe("POST /api/execute/swap", () => {
    it("returns 501 not implemented with valid auth", async () => {
      setupPassingGuards();

      const response = await swapPOST(
        postRequest("/swap", { fromToken: "ETH", toToken: "USDC" })
      );

      expect(response.status).toBe(501);
      const data = await response.json();
      expect(data.message).toBe("Coming soon");
    });

    it("returns 401 when auth fails", async () => {
      mocks.validateApiKey.mockResolvedValue(null);

      const response = await swapPOST(
        postRequest("/swap", { fromToken: "ETH" })
      );

      expect(response.status).toBe(401);
    });
  });
});
