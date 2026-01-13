import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetricNames,
  type MetricsCollector,
  resetMetricsCollector,
  setMetricsCollector,
} from "@/keeperhub/lib/metrics";
import {
  recordExternalServiceCall,
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

    it("should record external service error when service specified", () => {
      recordPluginMetrics({
        pluginName: "discord",
        actionName: "send-message",
        durationMs: 1000,
        success: false,
        error: "Discord API rate limited",
        externalService: "discord-api",
      });

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.PLUGIN_ACTION_ERRORS,
        { message: "Discord API rate limited" },
        expect.any(Object)
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.EXTERNAL_SERVICE_ERRORS,
        { message: "Discord API rate limited" },
        expect.objectContaining({
          service: "discord-api",
          plugin_name: "discord",
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

    it("should include executionId in labels when provided", async () => {
      await withPluginMetrics(
        {
          pluginName: "web3",
          actionName: "check-balance",
          executionId: "exec_456",
        },
        async () => ({ success: true })
      );

      expect(mockCollector.incrementCounter).toHaveBeenCalledWith(
        MetricNames.PLUGIN_INVOCATIONS_TOTAL,
        expect.objectContaining({
          execution_id: "exec_456",
        })
      );
    });
  });

  describe("recordExternalServiceCall", () => {
    it("should record successful external service call", () => {
      recordExternalServiceCall({
        service: "discord-webhook",
        durationMs: 120,
        success: true,
        statusCode: 200,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "external.service.latency_ms",
        120,
        expect.objectContaining({
          service: "discord-webhook",
          status: "success",
          status_code: "200",
        })
      );
      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record failed external service call with error", () => {
      recordExternalServiceCall({
        service: "sendgrid-api",
        durationMs: 5000,
        success: false,
        statusCode: 503,
        error: "Service unavailable",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "external.service.latency_ms",
        5000,
        expect.objectContaining({
          service: "sendgrid-api",
          status: "failure",
          status_code: "503",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.EXTERNAL_SERVICE_ERRORS,
        { message: "Service unavailable" },
        expect.objectContaining({
          service: "sendgrid-api",
        })
      );
    });
  });
});
