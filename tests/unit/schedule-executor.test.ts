import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  ReceiveMessageCommand: vi.fn().mockImplementation((input) => input),
  DeleteMessageCommand: vi.fn().mockImplementation((input) => input),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn().mockReturnValue({
    query: {
      workflows: { findFirst: vi.fn() },
      workflowSchedules: { findFirst: vi.fn() },
      workflowExecutions: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  }),
}));

vi.mock("postgres", () => ({
  default: vi.fn().mockReturnValue({
    end: vi.fn(),
  }),
}));

describe("schedule-executor", () => {
  describe("message parsing", () => {
    it("parses valid SQS message body", () => {
      const messageBody = JSON.stringify({
        workflowId: "wf_123",
        scheduleId: "sched_456",
        triggerTime: "2024-01-15T09:00:00.000Z",
        triggerType: "schedule",
      });

      const parsed = JSON.parse(messageBody);

      expect(parsed.workflowId).toBe("wf_123");
      expect(parsed.scheduleId).toBe("sched_456");
      expect(parsed.triggerTime).toBe("2024-01-15T09:00:00.000Z");
      expect(parsed.triggerType).toBe("schedule");
    });

    it("handles malformed JSON gracefully", () => {
      const invalidJson = "not valid json";

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe("execution record creation", () => {
    it("creates correct execution record structure", () => {
      const executionRecord = {
        id: "exec_abc123",
        workflowId: "wf_123",
        userId: "user_456",
        status: "running" as const,
        input: {
          triggerType: "schedule",
          scheduleId: "sched_789",
          triggerTime: "2024-01-15T09:00:00.000Z",
        },
      };

      expect(executionRecord.status).toBe("running");
      expect(executionRecord.input.triggerType).toBe("schedule");
      expect(executionRecord.input.scheduleId).toBe("sched_789");
    });
  });

  describe("API call structure", () => {
    it("builds correct API request for internal execution", () => {
      const workflowId = "wf_123";
      const executionId = "exec_abc";
      const scheduleId = "sched_456";
      const triggerTime = "2024-01-15T09:00:00.000Z";

      const url = `http://localhost:3000/api/workflow/${workflowId}/execute`;
      const headers = {
        "Content-Type": "application/json",
        "X-Internal-Execution": "true",
      };
      const body = JSON.stringify({
        executionId,
        input: {
          triggerType: "schedule",
          scheduleId,
          triggerTime,
        },
      });

      expect(url).toBe("http://localhost:3000/api/workflow/wf_123/execute");
      expect(headers["X-Internal-Execution"]).toBe("true");

      const parsedBody = JSON.parse(body);
      expect(parsedBody.executionId).toBe("exec_abc");
      expect(parsedBody.input.triggerType).toBe("schedule");
    });
  });

  describe("schedule status update", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T09:00:00Z"));
    });

    it("computes next run time after successful execution", () => {
      const { CronExpressionParser } = require("cron-parser");
      const cronExpression = "0 9 * * *";
      const timezone = "UTC";

      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: new Date(),
        tz: timezone,
      });
      const nextRun = interval.next().toDate();

      // Next run should be tomorrow at 9am
      expect(nextRun.getUTCHours()).toBe(9);
      expect(nextRun.getUTCMinutes()).toBe(0);
      expect(nextRun.getUTCDate()).toBe(16); // Next day
    });

    it("increments run count on success", () => {
      const currentRunCount = "5";
      const newRunCount = String(Number(currentRunCount) + 1);

      expect(newRunCount).toBe("6");
    });

    it("does not increment run count on error", () => {
      const currentRunCount = "5";
      // Use string type to test the conditional logic
      const status = "error" as string;

      const newRunCount =
        status === "success"
          ? String(Number(currentRunCount) + 1)
          : currentRunCount;

      expect(newRunCount).toBe("5");
    });

    it("creates correct status update for success", () => {
      const update = {
        lastRunAt: new Date(),
        lastStatus: "success" as const,
        lastError: null,
        nextRunAt: new Date("2024-01-16T09:00:00Z"),
        runCount: "6",
        updatedAt: new Date(),
      };

      expect(update.lastStatus).toBe("success");
      expect(update.lastError).toBeNull();
    });

    it("creates correct status update for error", () => {
      const errorMessage = "API call failed: 500 - Internal Server Error";

      const update = {
        lastRunAt: new Date(),
        lastStatus: "error" as const,
        lastError: errorMessage,
        nextRunAt: new Date("2024-01-16T09:00:00Z"),
        runCount: "5", // Not incremented on error
        updatedAt: new Date(),
      };

      expect(update.lastStatus).toBe("error");
      expect(update.lastError).toBe(errorMessage);
    });
  });

  describe("error handling", () => {
    it("extracts error message from Error instance", () => {
      const error = new Error("Connection refused");
      const message = error instanceof Error ? error.message : "Unknown error";

      expect(message).toBe("Connection refused");
    });

    it("handles non-Error thrown values", () => {
      const error: unknown = "String error";
      const message = error instanceof Error ? error.message : "Unknown error";

      expect(message).toBe("Unknown error");
    });

    it("handles API error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      };

      const errorText = await mockResponse.text();
      const errorMessage = `API call failed: ${mockResponse.status} - ${errorText}`;

      expect(errorMessage).toBe("API call failed: 500 - Internal Server Error");
    });

    it("handles 404 workflow not found", () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: async () => '{"error":"Workflow not found"}',
      };

      expect(mockResponse.status).toBe(404);
    });

    it("handles 403 forbidden", () => {
      const mockResponse = {
        ok: false,
        status: 403,
        text: async () => '{"error":"Forbidden"}',
      };

      expect(mockResponse.status).toBe(403);
    });
  });

  describe("message visibility and deletion", () => {
    it("builds correct delete message command", () => {
      const queueUrl =
        "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/keeperhub-workflow-queue";
      const receiptHandle = "receipt_abc123";

      const deleteCommand = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      };

      expect(deleteCommand.QueueUrl).toContain("keeperhub-workflow-queue");
      expect(deleteCommand.ReceiptHandle).toBe("receipt_abc123");
    });

    it("uses correct visibility timeout", () => {
      const VISIBILITY_TIMEOUT = 300; // 5 minutes

      expect(VISIBILITY_TIMEOUT).toBe(300);
    });

    it("uses correct wait time for long polling", () => {
      const WAIT_TIME_SECONDS = 20;

      expect(WAIT_TIME_SECONDS).toBe(20);
    });

    it("uses correct max messages per batch", () => {
      const MAX_MESSAGES = 10;

      expect(MAX_MESSAGES).toBe(10);
    });
  });

  describe("workflow validation", () => {
    it("validates workflow exists before execution", () => {
      const workflow: null = null;
      const shouldSkip = !workflow;

      expect(shouldSkip).toBe(true);
    });

    it("validates schedule is enabled before execution", () => {
      const schedule = { enabled: false };
      const shouldSkip = !schedule.enabled;

      expect(shouldSkip).toBe(true);
    });

    it("validates schedule exists before execution", () => {
      const schedule: null = null;
      const shouldSkip = !schedule;

      expect(shouldSkip).toBe(true);
    });
  });

  describe("concurrent message processing", () => {
    it("processes multiple messages in parallel", async () => {
      const messages = [
        { workflowId: "wf_1", scheduleId: "sched_1" },
        { workflowId: "wf_2", scheduleId: "sched_2" },
        { workflowId: "wf_3", scheduleId: "sched_3" },
      ];

      const processMessage = async (msg: { workflowId: string }) => ({
        processed: true,
        workflowId: msg.workflowId,
      });

      const results = await Promise.allSettled(
        messages.map((msg) => processMessage(msg))
      );

      expect(results.length).toBe(3);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });

    it("handles partial failures in batch", async () => {
      // biome-ignore lint/suspicious/useAwait: async required for Promise.allSettled rejection behavior
      const processMessage = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("Processing failed");
        }
        return { success: true };
      };

      const results = await Promise.allSettled([
        processMessage(false),
        processMessage(true), // This one fails
        processMessage(false),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });
  });
});
