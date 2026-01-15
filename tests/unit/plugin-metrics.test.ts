import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetricNames,
  type MetricsCollector,
  resetMetricsCollector,
  setMetricsCollector,
} from "@/keeperhub/lib/metrics";
import {
  recordPluginMetrics,
  withPluginMetrics,
} from "@/keeperhub/lib/metrics/instrumentation/plugin";

describe("Plugin Metrics Instrumentation", () => {
  let mockCollector: MetricsCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMetricsCollector();

    mockCollector = {
      recordLatency: vi.fn(),
      incrementCounter: vi.fn(),
      recordError: vi.fn(),
      setGauge: vi.fn(),
    };
    setMetricsCollector(mockCollector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMetricsCollector();
  });

  describe("recordPluginMetrics", () => {
    it("should record successful plugin action", () => {
      recordPluginMetrics({
        pluginName: "discord",
        actionName: "send-message",
        executionId: "exec_123",
        durationMs: 150,
        success: true,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        150,
        expect.objectContaining({
          plugin_name: "discord",
          action_name: "send-message",
          execution_id: "exec_123",
          status: "success",
        })
      );
      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record failed plugin action with error", () => {
      recordPluginMetrics({
        pluginName: "sendgrid",
        actionName: "send-email",
        durationMs: 500,
        success: false,
        error: "Invalid API key",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        500,
        expect.objectContaining({
          plugin_name: "sendgrid",
          action_name: "send-email",
          status: "failure",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_ERRORS,
        { message: "Invalid API key" },
        expect.objectContaining({
          plugin_name: "sendgrid",
          action_name: "send-email",
        })
      );
    });

  });

  describe("withPluginMetrics", () => {
    it("should increment counter and record latency on success", async () => {
      const result = await withPluginMetrics(
        { pluginName: "webhook", actionName: "send-webhook" },
        async () => ({ success: true, data: "ok" })
      );

      expect(result).toEqual({ success: true, data: "ok" });
      expect(mockCollector.incrementCounter).toHaveBeenCalledWith(
        MetricNames.PLUGIN_INVOCATIONS_TOTAL,
        expect.objectContaining({
          plugin_name: "webhook",
          action_name: "send-webhook",
        })
      );
      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        expect.any(Number),
        expect.objectContaining({
          plugin_name: "webhook",
          action_name: "send-webhook",
          status: "success",
        })
      );
    });

    it("should record failure when result has success: false", async () => {
      const result = await withPluginMetrics(
        { pluginName: "discord", actionName: "send-message" },
        async () => ({ success: false, error: "Webhook URL invalid" })
      );

      expect(result).toEqual({ success: false, error: "Webhook URL invalid" });
      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        expect.any(Number),
        expect.objectContaining({
          status: "failure",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_ERRORS,
        { message: "Webhook URL invalid" },
        expect.any(Object)
      );
    });

    it("should record error and rethrow on exception", async () => {
      const testError = new Error("Connection failed");

      await expect(
        withPluginMetrics(
          { pluginName: "sendgrid", actionName: "send-email" },
          () => Promise.reject(testError)
        )
      ).rejects.toThrow("Connection failed");

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        expect.any(Number),
        expect.objectContaining({
          status: "failure",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_ERRORS,
        testError,
        expect.any(Object)
      );
    });

    it("should include executionId in latency labels when provided", async () => {
      await withPluginMetrics(
        {
          pluginName: "web3",
          actionName: "check-balance",
          executionId: "exec_456",
        },
        async () => ({ success: true })
      );

      // Counter only uses plugin_name and action_name (not execution_id)
      expect(mockCollector.incrementCounter).toHaveBeenCalledWith(
        MetricNames.PLUGIN_INVOCATIONS_TOTAL,
        {
          plugin_name: "web3",
          action_name: "check-balance",
        }
      );

      // Latency metric includes execution_id
      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_DURATION,
        expect.any(Number),
        expect.objectContaining({
          execution_id: "exec_456",
        })
      );
    });
  });
});
