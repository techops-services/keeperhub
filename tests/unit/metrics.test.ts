import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consoleMetricsCollector,
  noopMetricsCollector,
  getMetricsCollector,
  setMetricsCollector,
  resetMetricsCollector,
  createTimer,
  withLatencyTracking,
  withMetrics,
  createPrefixedConsoleCollector,
  MetricNames,
  LabelKeys,
  type MetricsCollector,
} from "@/keeperhub/lib/metrics";

describe("Metrics Collectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMetricsCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMetricsCollector();
  });

  describe("consoleMetricsCollector", () => {
    it("should output JSON for recordLatency", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.recordLatency("test.latency", 100, {
        workflow_id: "wf_123",
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.metric.name).toBe("test.latency");
      expect(output.metric.type).toBe("histogram");
      expect(output.metric.value).toBe(100);
      expect(output.metric.labels).toEqual({ workflow_id: "wf_123" });
      expect(output.level).toBe("info");
      expect(output.timestamp).toBeDefined();
    });

    it("should output JSON for incrementCounter", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.incrementCounter("test.counter", {
        trigger_type: "webhook",
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.metric.name).toBe("test.counter");
      expect(output.metric.type).toBe("counter");
      expect(output.metric.value).toBe(1);
      expect(output.metric.labels).toEqual({ trigger_type: "webhook" });
    });

    it("should increment counter with custom value", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.incrementCounter("test.counter", {}, 5);

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.metric.value).toBe(5);
    });

    it("should output JSON for recordError with Error object", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const error = new Error("Test error message");
      consoleMetricsCollector.recordError("test.errors", error, {
        plugin_name: "web3",
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.metric.name).toBe("test.errors");
      expect(output.metric.type).toBe("counter");
      expect(output.metric.value).toBe(1);
      expect(output.metric.labels.plugin_name).toBe("web3");
      expect(output.metric.labels.error_message).toBe("Test error message");
      expect(output.level).toBe("error");
      expect(output.error).toBeDefined();
      expect(output.error.message).toBe("Test error message");
    });

    it("should output JSON for recordError with ErrorContext", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      consoleMetricsCollector.recordError(
        "test.errors",
        { code: "ERR_TIMEOUT", message: "Request timed out" },
        { service: "discord" }
      );

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.metric.labels.error_code).toBe("ERR_TIMEOUT");
      expect(output.metric.labels.error_message).toBe("Request timed out");
      expect(output.error.code).toBe("ERR_TIMEOUT");
    });

    it("should output JSON for setGauge", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.setGauge("test.gauge", 42, {
        resource: "db_pool",
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.metric.name).toBe("test.gauge");
      expect(output.metric.type).toBe("gauge");
      expect(output.metric.value).toBe(42);
      expect(output.metric.labels).toEqual({ resource: "db_pool" });
    });

    it("should handle labels with different value types", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.recordLatency("test.latency", 50, {
        count: 123,
        enabled: true,
        name: "test",
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      // All values should be stringified
      expect(output.metric.labels).toEqual({
        count: "123",
        enabled: "true",
        name: "test",
      });
    });

    it("should handle undefined labels", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      consoleMetricsCollector.recordLatency("test.latency", 50);

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.metric.labels).toBeUndefined();
    });
  });

  describe("noopMetricsCollector", () => {
    it("should not throw on recordLatency", () => {
      expect(() => {
        noopMetricsCollector.recordLatency("test", 100, { key: "value" });
      }).not.toThrow();
    });

    it("should not throw on incrementCounter", () => {
      expect(() => {
        noopMetricsCollector.incrementCounter("test", { key: "value" });
      }).not.toThrow();
    });

    it("should not throw on recordError", () => {
      expect(() => {
        noopMetricsCollector.recordError("test", new Error("test"));
      }).not.toThrow();
    });

    it("should not throw on setGauge", () => {
      expect(() => {
        noopMetricsCollector.setGauge("test", 42);
      }).not.toThrow();
    });

    it("should not output to console", () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      noopMetricsCollector.recordLatency("test", 100);
      noopMetricsCollector.incrementCounter("test");
      noopMetricsCollector.recordError("test", new Error("test"));
      noopMetricsCollector.setGauge("test", 42);

      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("createPrefixedConsoleCollector", () => {
    it("should prefix all metric names", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const prefixed = createPrefixedConsoleCollector("myapp");

      prefixed.recordLatency("request.duration", 100);

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.metric.name).toBe("myapp.request.duration");
    });
  });

  describe("getMetricsCollector", () => {
    it("should return the same instance on multiple calls", () => {
      const collector1 = getMetricsCollector();
      const collector2 = getMetricsCollector();

      expect(collector1).toBe(collector2);
    });

    it("should respect setMetricsCollector", () => {
      const customCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };

      setMetricsCollector(customCollector);

      const collector = getMetricsCollector();
      expect(collector).toBe(customCollector);
    });

    it("should reset after resetMetricsCollector", () => {
      const customCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };

      setMetricsCollector(customCollector);
      resetMetricsCollector();

      const collector = getMetricsCollector();
      expect(collector).not.toBe(customCollector);
    });
  });

  describe("createTimer", () => {
    it("should return elapsed time in milliseconds", async () => {
      const timer = createTimer();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const elapsed = timer();
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
      expect(elapsed).toBeLessThan(200);
    });

    it("should return integer values", () => {
      const timer = createTimer();
      const elapsed = timer();

      expect(Number.isInteger(elapsed)).toBe(true);
    });
  });

  describe("withLatencyTracking", () => {
    it("should track latency for successful operations", async () => {
      const mockCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };
      setMetricsCollector(mockCollector);

      const result = await withLatencyTracking(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "success";
        },
        "test.operation",
        { operation: "test" }
      );

      expect(result).toBe("success");
      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "test.operation",
        expect.any(Number),
        { operation: "test", status: "success" }
      );
    });

    it("should track latency for failed operations and rethrow", async () => {
      const mockCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };
      setMetricsCollector(mockCollector);

      const testError = new Error("Test failure");

      await expect(
        withLatencyTracking(async () => {
          throw testError;
        }, "test.operation")
      ).rejects.toThrow("Test failure");

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "test.operation",
        expect.any(Number),
        { status: "failure" }
      );
    });
  });

  describe("withMetrics", () => {
    it("should track latency, counter, and errors", async () => {
      const mockCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };
      setMetricsCollector(mockCollector);

      await withMetrics(async () => "result", {
        latencyMetric: "op.duration",
        counterMetric: "op.count",
        errorMetric: "op.errors",
        labels: { type: "test" },
      });

      expect(mockCollector.incrementCounter).toHaveBeenCalledWith("op.count", {
        type: "test",
      });
      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "op.duration",
        expect.any(Number),
        { type: "test", status: "success" }
      );
      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record error on failure", async () => {
      const mockCollector: MetricsCollector = {
        recordLatency: vi.fn(),
        incrementCounter: vi.fn(),
        recordError: vi.fn(),
        setGauge: vi.fn(),
      };
      setMetricsCollector(mockCollector);

      const testError = new Error("Operation failed");

      await expect(
        withMetrics(
          async () => {
            throw testError;
          },
          {
            latencyMetric: "op.duration",
            errorMetric: "op.errors",
            labels: { type: "test" },
          }
        )
      ).rejects.toThrow("Operation failed");

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        "op.duration",
        expect.any(Number),
        { type: "test", status: "failure" }
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        "op.errors",
        testError,
        { type: "test" }
      );
    });
  });

  describe("MetricNames constants", () => {
    it("should have expected latency metrics", () => {
      expect(MetricNames.WORKFLOW_EXECUTION_DURATION).toBe(
        "workflow.execution.duration_ms"
      );
      expect(MetricNames.WORKFLOW_STEP_DURATION).toBe(
        "workflow.step.duration_ms"
      );
      expect(MetricNames.API_WEBHOOK_LATENCY).toBe("api.webhook.latency_ms");
    });

    it("should have expected traffic metrics", () => {
      expect(MetricNames.WORKFLOW_EXECUTIONS_TOTAL).toBe(
        "workflow.executions.total"
      );
      expect(MetricNames.PLUGIN_INVOCATIONS_TOTAL).toBe(
        "plugin.invocations.total"
      );
    });

    it("should have expected error metrics", () => {
      expect(MetricNames.WORKFLOW_EXECUTION_ERRORS).toBe(
        "workflow.execution.errors"
      );
      expect(MetricNames.PLUGIN_ACTION_ERRORS).toBe("plugin.action.errors");
    });

    it("should have expected saturation metrics", () => {
      expect(MetricNames.WORKFLOW_CONCURRENT_COUNT).toBe(
        "workflow.concurrent.count"
      );
      expect(MetricNames.DB_POOL_UTILIZATION).toBe("db.pool.utilization");
    });
  });

  describe("LabelKeys constants", () => {
    it("should have expected label keys", () => {
      expect(LabelKeys.WORKFLOW_ID).toBe("workflow_id");
      expect(LabelKeys.PLUGIN_NAME).toBe("plugin_name");
      expect(LabelKeys.TRIGGER_TYPE).toBe("trigger_type");
      expect(LabelKeys.STATUS).toBe("status");
    });
  });
});
