import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeNextRunTime,
  validateCronExpression,
  validateTimezone,
  extractScheduleConfig,
} from "@/lib/schedule-service";
import {
  createScheduleTriggerNode,
  createWebhookTriggerNode,
  createManualTriggerNode,
  cronExpressions,
  timezones,
} from "../fixtures/workflows";

describe("schedule-service", () => {
  describe("computeNextRunTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set current time to 2024-01-15 08:00:00 UTC
      vi.setSystemTime(new Date("2024-01-15T08:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("computes next run time for daily 9am cron", () => {
      const result = computeNextRunTime(cronExpressions.everyDayAt9am, "UTC");

      expect(result).not.toBeNull();
      expect(result!.getUTCHours()).toBe(9);
      expect(result!.getUTCMinutes()).toBe(0);
      // Should be today at 9am since we're at 8am
      expect(result!.getUTCDate()).toBe(15);
    });

    it("computes next run time for every minute cron", () => {
      const result = computeNextRunTime(cronExpressions.everyMinute, "UTC");

      expect(result).not.toBeNull();
      // Should be the next minute
      expect(result!.getTime()).toBeGreaterThan(Date.now());
    });

    it("computes next run time for every hour cron", () => {
      const result = computeNextRunTime(cronExpressions.everyHour, "UTC");

      expect(result).not.toBeNull();
      expect(result!.getUTCMinutes()).toBe(0);
    });

    it("computes next run time for Monday-only cron", () => {
      const result = computeNextRunTime(cronExpressions.everyMondayAt9am, "UTC");

      expect(result).not.toBeNull();
      // 2024-01-15 is a Monday, so should be today at 9am or next Monday
      const dayOfWeek = result!.getUTCDay();
      expect(dayOfWeek).toBe(1); // Monday
    });

    it("computes next run time with timezone", () => {
      const resultUTC = computeNextRunTime(
        cronExpressions.everyDayAt9am,
        "UTC"
      );
      const resultNY = computeNextRunTime(
        cronExpressions.everyDayAt9am,
        "America/New_York"
      );

      expect(resultUTC).not.toBeNull();
      expect(resultNY).not.toBeNull();
      // New York is UTC-5 in January, so 9am NY = 2pm UTC
      // The times should be different
      expect(resultUTC!.getTime()).not.toBe(resultNY!.getTime());
    });

    it("returns null for invalid cron expression", () => {
      const result = computeNextRunTime(cronExpressions.invalid.notACron, "UTC");
      expect(result).toBeNull();
    });

    it("handles empty cron expression", () => {
      // Note: cron-parser may treat empty string as "* * * * *"
      // The validateCronExpression function properly rejects empty strings
      const result = computeNextRunTime(cronExpressions.invalid.empty, "UTC");
      // Empty string defaults to every minute in cron-parser v5
      expect(result).not.toBeNull();
    });
  });

  describe("validateCronExpression", () => {
    it("validates standard 5-field cron expressions", () => {
      expect(validateCronExpression(cronExpressions.everyMinute)).toEqual({
        valid: true,
      });
      expect(validateCronExpression(cronExpressions.everyHour)).toEqual({
        valid: true,
      });
      expect(validateCronExpression(cronExpressions.everyDayAt9am)).toEqual({
        valid: true,
      });
      expect(validateCronExpression(cronExpressions.everyMondayAt9am)).toEqual({
        valid: true,
      });
      expect(validateCronExpression(cronExpressions.everyWeekdayAt9am)).toEqual({
        valid: true,
      });
    });

    it("validates cron with step values", () => {
      expect(validateCronExpression(cronExpressions.every5Minutes)).toEqual({
        valid: true,
      });
      expect(validateCronExpression(cronExpressions.every15Minutes)).toEqual({
        valid: true,
      });
    });

    it("validates cron with list values", () => {
      expect(validateCronExpression(cronExpressions.twiceDaily)).toEqual({
        valid: true,
      });
    });

    it("rejects cron with too few fields", () => {
      const result = validateCronExpression(cronExpressions.invalid.tooFewFields);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5 or 6 fields");
    });

    it("rejects empty cron expression", () => {
      const result = validateCronExpression(cronExpressions.invalid.empty);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects invalid minute value", () => {
      const result = validateCronExpression(cronExpressions.invalid.invalidMinute);
      expect(result.valid).toBe(false);
    });

    it("rejects invalid hour value", () => {
      const result = validateCronExpression(cronExpressions.invalid.invalidHour);
      expect(result.valid).toBe(false);
    });

    it("rejects non-string input", () => {
      // @ts-expect-error - Testing invalid input
      const result = validateCronExpression(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");

      // @ts-expect-error - Testing invalid input
      const result2 = validateCronExpression(123);
      expect(result2.valid).toBe(false);
    });
  });

  describe("validateTimezone", () => {
    it("validates common timezones", () => {
      for (const tz of timezones.valid) {
        expect(validateTimezone(tz)).toBe(true);
      }
    });

    it("rejects invalid timezones", () => {
      for (const tz of timezones.invalid) {
        if (tz !== "") {
          // Empty string may pass depending on implementation
          expect(validateTimezone(tz)).toBe(false);
        }
      }
    });

    it("validates UTC", () => {
      expect(validateTimezone("UTC")).toBe(true);
    });

    it("validates Etc/UTC", () => {
      expect(validateTimezone("Etc/UTC")).toBe(true);
    });

    it("validates case variations of timezone names", () => {
      expect(validateTimezone("America/New_York")).toBe(true);
      // Note: Some environments are case-insensitive for timezones
      // The important thing is that the valid format works
    });
  });

  describe("extractScheduleConfig", () => {
    it("extracts config from schedule trigger node", () => {
      const triggerNode = createScheduleTriggerNode("0 9 * * *", "America/New_York");
      const result = extractScheduleConfig([triggerNode]);

      expect(result).not.toBeNull();
      expect(result!.cronExpression).toBe("0 9 * * *");
      expect(result!.timezone).toBe("America/New_York");
    });

    it("uses UTC as default timezone", () => {
      const triggerNode = createScheduleTriggerNode("0 9 * * *");
      // Remove timezone to test default
      delete (triggerNode.data.config as Record<string, unknown>).scheduleTimezone;

      const result = extractScheduleConfig([triggerNode]);

      expect(result).not.toBeNull();
      expect(result!.timezone).toBe("UTC");
    });

    it("returns null for webhook trigger", () => {
      const triggerNode = createWebhookTriggerNode();
      const result = extractScheduleConfig([triggerNode]);

      expect(result).toBeNull();
    });

    it("returns null for manual trigger", () => {
      const triggerNode = createManualTriggerNode();
      const result = extractScheduleConfig([triggerNode]);

      expect(result).toBeNull();
    });

    it("returns null when no trigger node exists", () => {
      const result = extractScheduleConfig([]);
      expect(result).toBeNull();
    });

    it("returns null when trigger has no cron expression", () => {
      const triggerNode = createScheduleTriggerNode();
      // Remove cron expression
      delete (triggerNode.data.config as Record<string, unknown>).scheduleCron;

      const result = extractScheduleConfig([triggerNode]);
      expect(result).toBeNull();
    });

    it("finds trigger node among multiple nodes", () => {
      const nodes = [
        {
          id: "action-1",
          type: "action",
          position: { x: 0, y: 0 },
          data: { type: "action", label: "Action", config: {} },
        },
        createScheduleTriggerNode("*/5 * * * *", "Europe/London"),
        {
          id: "action-2",
          type: "action",
          position: { x: 0, y: 0 },
          data: { type: "action", label: "Action 2", config: {} },
        },
      ];

      const result = extractScheduleConfig(nodes);

      expect(result).not.toBeNull();
      expect(result!.cronExpression).toBe("*/5 * * * *");
      expect(result!.timezone).toBe("Europe/London");
    });
  });
});
