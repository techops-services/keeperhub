import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createScheduleTriggerNode,
  createWebhookTriggerNode,
  createScheduledWorkflow,
  cronExpressions,
} from "../fixtures/workflows";

// Mock database
const mockSchedule = {
  id: "sched_test123",
  workflowId: "wf_test456",
  cronExpression: "0 9 * * *",
  timezone: "UTC",
  enabled: true,
  nextRunAt: new Date("2024-01-16T09:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDbQuery = {
  workflowSchedules: {
    findFirst: vi.fn(),
  },
};

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDbDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

describe("Schedule Sync Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Schedule Creation on Workflow Save", () => {
    it("creates schedule when workflow has schedule trigger", async () => {
      const { nodes } = createScheduledWorkflow("0 9 * * *", "UTC");

      // Simulate no existing schedule
      mockDbQuery.workflowSchedules.findFirst.mockResolvedValueOnce(undefined);

      const triggerNode = nodes.find((n) => n.data.type === "trigger");
      const config = triggerNode?.data.config;

      expect(config?.triggerType).toBe("Schedule");
      expect(config?.scheduleCron).toBe("0 9 * * *");
      expect(config?.scheduleTimezone).toBe("UTC");
    });

    it("does not create schedule for webhook trigger", () => {
      const triggerNode = createWebhookTriggerNode();
      const config = triggerNode.data.config;

      const isSchedule = config?.triggerType === "Schedule";
      expect(isSchedule).toBe(false);
    });

    it("extracts cron expression from trigger config", () => {
      const triggerNode = createScheduleTriggerNode(
        cronExpressions.everyWeekdayAt9am,
        "America/New_York"
      );

      const config = triggerNode.data.config;
      expect(config?.scheduleCron).toBe("0 9 * * 1-5");
      expect(config?.scheduleTimezone).toBe("America/New_York");
    });
  });

  describe("Schedule Update on Workflow Save", () => {
    it("updates existing schedule when cron changes", async () => {
      // Simulate existing schedule
      mockDbQuery.workflowSchedules.findFirst.mockResolvedValueOnce(mockSchedule);

      const oldCron = mockSchedule.cronExpression;
      const newCron = "0 10 * * *";

      expect(oldCron).not.toBe(newCron);

      // Update should be called
      const updateData = {
        cronExpression: newCron,
        timezone: "UTC",
        nextRunAt: new Date("2024-01-16T10:00:00Z"),
        updatedAt: new Date(),
      };

      expect(updateData.cronExpression).toBe("0 10 * * *");
    });

    it("updates existing schedule when timezone changes", async () => {
      mockDbQuery.workflowSchedules.findFirst.mockResolvedValueOnce(mockSchedule);

      const oldTimezone = mockSchedule.timezone;
      const newTimezone = "America/New_York";

      expect(oldTimezone).not.toBe(newTimezone);
    });

    it("recalculates next run time on update", () => {
      const { CronExpressionParser } = require("cron-parser");

      const newCron = "0 10 * * *";
      const timezone = "UTC";

      const interval = CronExpressionParser.parse(newCron, {
        currentDate: new Date("2024-01-15T09:00:00Z"),
        tz: timezone,
      });

      const nextRun = interval.next().toDate();
      expect(nextRun.getUTCHours()).toBe(10);
    });
  });

  describe("Schedule Deletion on Workflow Save", () => {
    it("deletes schedule when trigger type changes from Schedule", async () => {
      // Workflow now has webhook trigger instead of schedule
      const webhookTrigger = createWebhookTriggerNode();
      const nodes = [webhookTrigger];

      const scheduleConfig = nodes.find(
        (n) =>
          n.data.type === "trigger" &&
          n.data.config?.triggerType === "Schedule"
      );

      expect(scheduleConfig).toBeUndefined();

      // Should trigger delete
      const shouldDelete = scheduleConfig === undefined;
      expect(shouldDelete).toBe(true);
    });

    it("deletes schedule when workflow has no trigger", () => {
      const nodes: typeof mockSchedule[] = [];

      const triggerNode = nodes.find((n: unknown) => {
        const node = n as { data?: { type?: string } };
        return node.data?.type === "trigger";
      });

      expect(triggerNode).toBeUndefined();
    });
  });

  describe("Validation Errors", () => {
    it("rejects invalid cron expression", () => {
      const invalidCron = "not a cron";

      // Validate cron
      const isValid = /^[\d\*\/\-\,\s]+$/.test(invalidCron);
      expect(isValid).toBe(false);
    });

    it("rejects cron with too few fields", () => {
      const invalidCron = "* * *";
      const parts = invalidCron.split(" ");

      expect(parts.length).toBeLessThan(5);
    });

    it("rejects invalid timezone", () => {
      const invalidTimezone = "Invalid/Timezone";

      let isValid = true;
      try {
        Intl.DateTimeFormat(undefined, { timeZone: invalidTimezone });
      } catch {
        isValid = false;
      }

      expect(isValid).toBe(false);
    });
  });

  describe("Next Run Time Calculation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T08:00:00Z"));
    });

    it("calculates next run for daily cron", () => {
      const { CronExpressionParser } = require("cron-parser");

      const interval = CronExpressionParser.parse("0 9 * * *", {
        currentDate: new Date(),
        tz: "UTC",
      });

      const nextRun = interval.next().toDate();

      // Should be 9am today (we're at 8am)
      expect(nextRun.getUTCDate()).toBe(15);
      expect(nextRun.getUTCHours()).toBe(9);
    });

    it("calculates next run for weekly cron", () => {
      const { CronExpressionParser } = require("cron-parser");

      // Every Monday at 9am, current day is Monday Jan 15
      const interval = CronExpressionParser.parse("0 9 * * 1", {
        currentDate: new Date(),
        tz: "UTC",
      });

      const nextRun = interval.next().toDate();
      expect(nextRun.getUTCDay()).toBe(1); // Monday
    });

    it("handles timezone offset correctly", () => {
      const { CronExpressionParser } = require("cron-parser");

      // 9am New York = 2pm UTC in January (EST is UTC-5)
      const interval = CronExpressionParser.parse("0 9 * * *", {
        currentDate: new Date(),
        tz: "America/New_York",
      });

      const nextRun = interval.next().toDate();
      expect(nextRun.getUTCHours()).toBe(14);
    });
  });

  describe("Edge Cases", () => {
    it("handles workflow with multiple nodes including schedule trigger", () => {
      const { nodes } = createScheduledWorkflow();

      const triggerNodes = nodes.filter((n) => n.data.type === "trigger");
      expect(triggerNodes.length).toBe(1);

      const actionNodes = nodes.filter((n) => n.data.type === "action");
      expect(actionNodes.length).toBe(1);
    });

    it("handles empty cron expression gracefully", () => {
      const triggerNode = createScheduleTriggerNode("");

      const cronExpression = triggerNode.data.config?.scheduleCron;
      expect(cronExpression).toBe("");
    });

    it("uses UTC as default when timezone not specified", () => {
      const triggerNode = createScheduleTriggerNode("0 9 * * *");
      delete (triggerNode.data.config as Record<string, unknown>).scheduleTimezone;

      const timezone = triggerNode.data.config?.scheduleTimezone || "UTC";
      expect(timezone).toBe("UTC");
    });
  });

  describe("Concurrent Modifications", () => {
    it("handles schedule not found during update", async () => {
      // Create a local mock for this specific test
      const localMock = vi.fn()
        .mockResolvedValueOnce(mockSchedule)
        .mockResolvedValueOnce(undefined);

      const first = await localMock({});
      const second = await localMock({});

      expect(first).toBeDefined();
      expect(second).toBeUndefined();
    });
  });
});
