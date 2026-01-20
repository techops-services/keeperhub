import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetricNames,
  type MetricsCollector,
  resetMetricsCollector,
  setMetricsCollector,
} from "@/keeperhub/lib/metrics";
import {
  recordStatusPollMetrics,
  recordWebhookMetrics,
} from "@/keeperhub/lib/metrics/instrumentation/api";

describe("API Metrics Instrumentation", () => {
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

  describe("recordWebhookMetrics", () => {
    it("should record successful webhook trigger", () => {
      recordWebhookMetrics({
        workflowId: "wf_123",
        executionId: "exec_456",
        durationMs: 45,
        statusCode: 200,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_WEBHOOK_LATENCY,
        45,
        expect.objectContaining({
          workflow_id: "wf_123",
          execution_id: "exec_456",
          status_code: "200",
          status: "success",
        })
      );

      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record failed webhook trigger with error", () => {
      recordWebhookMetrics({
        workflowId: "wf_123",
        durationMs: 100,
        statusCode: 401,
        error: "Invalid API key",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_WEBHOOK_LATENCY,
        100,
        expect.objectContaining({
          status_code: "401",
          status: "failure",
        })
      );

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.API_ERRORS_TOTAL,
        { message: "Invalid API key" },
        expect.objectContaining({
          endpoint: "webhook",
          status_code: "401",
        })
      );
    });

    it("should use 'unknown' for missing executionId", () => {
      recordWebhookMetrics({
        workflowId: "wf_123",
        durationMs: 30,
        statusCode: 200,
      });

      const labels = (mockCollector.recordLatency as ReturnType<typeof vi.fn>)
        .mock.calls[0][2];
      expect(labels.execution_id).toBe("unknown");
    });
  });

  describe("recordStatusPollMetrics", () => {
    it("should record successful status poll", () => {
      recordStatusPollMetrics({
        executionId: "exec_123",
        durationMs: 25,
        statusCode: 200,
        executionStatus: "running",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_STATUS_LATENCY,
        25,
        expect.objectContaining({
          execution_id: "exec_123",
          status_code: "200",
          status: "success",
          execution_status: "running",
        })
      );
    });

    it("should record failed status poll", () => {
      recordStatusPollMetrics({
        executionId: "exec_123",
        durationMs: 50,
        statusCode: 500,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_STATUS_LATENCY,
        50,
        expect.objectContaining({
          execution_id: "exec_123",
          status_code: "500",
          status: "failure",
        })
      );
    });

    it("should use 'unknown' for missing executionStatus", () => {
      recordStatusPollMetrics({
        executionId: "exec_123",
        durationMs: 20,
        statusCode: 200,
      });

      const labels = (mockCollector.recordLatency as ReturnType<typeof vi.fn>)
        .mock.calls[0][2];
      expect(labels.execution_status).toBe("unknown");
    });
  });
});
