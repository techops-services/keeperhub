import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startApiMetrics,
  recordWebhookMetrics,
  recordStatusPollMetrics,
} from "@/keeperhub/lib/metrics/instrumentation/api";
import {
  setMetricsCollector,
  resetMetricsCollector,
  MetricNames,
  type MetricsCollector,
} from "@/keeperhub/lib/metrics";

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

  describe("startApiMetrics", () => {
    it("should increment request counter on start", () => {
      startApiMetrics({ endpoint: "/api/test", method: "GET" });

      expect(mockCollector.incrementCounter).toHaveBeenCalledWith(
        MetricNames.API_REQUESTS_TOTAL,
        expect.objectContaining({
          endpoint: "/api/test",
          method: "GET",
        })
      );
    });

    it("should record latency on complete", async () => {
      const { complete } = startApiMetrics({ endpoint: "/api/test" });

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 10));

      complete(200);

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "api.request.latency_ms",
        expect.any(Number),
        expect.objectContaining({
          endpoint: "/api/test",
          status_code: "200",
          status: "success",
        })
      );
    });

    it("should record latency with failure status for 4xx/5xx", () => {
      const { complete } = startApiMetrics({ endpoint: "/api/test" });

      complete(404);

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "api.request.latency_ms",
        expect.any(Number),
        expect.objectContaining({
          status_code: "404",
          status: "failure",
        })
      );
    });

    it("should record error on recordError call", () => {
      const { recordError } = startApiMetrics({ endpoint: "/api/test" });

      recordError("Something went wrong", 500);

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "api.request.latency_ms",
        expect.any(Number),
        expect.objectContaining({
          status_code: "500",
          status: "failure",
        })
      );

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.API_ERRORS_TOTAL,
        { message: "Something went wrong" },
        expect.objectContaining({
          endpoint: "/api/test",
          status_code: "500",
        })
      );
    });

    it("should use webhook latency metric for webhook endpoints", () => {
      const { complete } = startApiMetrics({ endpoint: "/api/workflows/123/webhook" });

      complete(200);

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_WEBHOOK_LATENCY,
        expect.any(Number),
        expect.any(Object)
      );
    });

    it("should use status latency metric for status endpoints", () => {
      const { complete } = startApiMetrics({ endpoint: "/api/executions/123/status" });

      complete(200);

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.API_STATUS_LATENCY,
        expect.any(Number),
        expect.any(Object)
      );
    });
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

    it("should handle missing executionId", () => {
      recordWebhookMetrics({
        workflowId: "wf_123",
        durationMs: 30,
        statusCode: 200,
      });

      const labels = (mockCollector.recordLatency as ReturnType<typeof vi.fn>)
        .mock.calls[0][2];
      expect(labels.execution_id).toBeUndefined();
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

    it("should handle missing executionStatus", () => {
      recordStatusPollMetrics({
        executionId: "exec_123",
        durationMs: 20,
        statusCode: 200,
      });

      const labels = (mockCollector.recordLatency as ReturnType<typeof vi.fn>)
        .mock.calls[0][2];
      expect(labels.execution_status).toBeUndefined();
    });
  });
});
