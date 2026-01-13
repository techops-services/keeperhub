import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordWorkflowComplete,
  recordStepMetrics,
  detectTriggerType,
} from "@/keeperhub/lib/metrics/instrumentation/workflow";
import {
  setMetricsCollector,
  resetMetricsCollector,
  MetricNames,
  type MetricsCollector,
} from "@/keeperhub/lib/metrics";

describe("Workflow Metrics Instrumentation", () => {
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

  describe("recordWorkflowComplete", () => {
    it("should record successful workflow completion", () => {
      recordWorkflowComplete({
        workflowId: "wf_123",
        executionId: "exec_456",
        triggerType: "webhook",
        durationMs: 1500,
        success: true,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_EXECUTION_DURATION,
        1500,
        expect.objectContaining({
          workflow_id: "wf_123",
          execution_id: "exec_456",
          trigger_type: "webhook",
          status: "success",
        })
      );
      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record failed workflow with error", () => {
      recordWorkflowComplete({
        workflowId: "wf_123",
        executionId: "exec_456",
        triggerType: "manual",
        durationMs: 500,
        success: false,
        error: "Step failed: timeout",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_EXECUTION_DURATION,
        500,
        expect.objectContaining({
          status: "failure",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_EXECUTION_ERRORS,
        { message: "Step failed: timeout" },
        expect.objectContaining({
          workflow_id: "wf_123",
        })
      );
    });

    it("should record failed workflow with Error object", () => {
      const error = new Error("Connection refused");

      recordWorkflowComplete({
        workflowId: "wf_123",
        durationMs: 100,
        success: false,
        error,
      });

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_EXECUTION_ERRORS,
        error,
        expect.any(Object)
      );
    });
  });

  describe("recordStepMetrics", () => {
    it("should record successful step execution", () => {
      recordStepMetrics({
        executionId: "exec_123",
        nodeId: "node_1",
        nodeName: "Send Email",
        stepType: "SendGrid Send Email",
        durationMs: 250,
        success: true,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_STEP_DURATION,
        250,
        expect.objectContaining({
          execution_id: "exec_123",
          step_type: "SendGrid Send Email",
          status: "success",
        })
      );
      expect(mockCollector.recordError).not.toHaveBeenCalled();
    });

    it("should record failed step with error", () => {
      recordStepMetrics({
        executionId: "exec_123",
        nodeId: "node_1",
        nodeName: "HTTP Request",
        stepType: "HTTP Request",
        durationMs: 5000,
        success: false,
        error: "Request timed out",
      });

      expect(mockCollector.recordLatency).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_STEP_DURATION,
        5000,
        expect.objectContaining({
          status: "failure",
        })
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.WORKFLOW_STEP_ERRORS,
        { message: "Request timed out" },
        expect.objectContaining({
          step_type: "HTTP Request",
        })
      );
    });

    it("should handle missing executionId", () => {
      recordStepMetrics({
        nodeId: "node_1",
        nodeName: "Test Step",
        stepType: "Condition",
        durationMs: 10,
        success: true,
      });

      expect(mockCollector.recordLatency).toHaveBeenCalled();
      const labels = (mockCollector.recordLatency as ReturnType<typeof vi.fn>)
        .mock.calls[0][2];
      expect(labels.execution_id).toBeUndefined();
    });
  });

  describe("detectTriggerType", () => {
    it("should detect webhook trigger", () => {
      const nodes = [
        { data: { type: "trigger", config: { triggerType: "Webhook" } } },
        { data: { type: "action", config: { actionType: "HTTP Request" } } },
      ];

      expect(detectTriggerType(nodes)).toBe("webhook");
    });

    it("should detect scheduled trigger", () => {
      const nodes = [
        { data: { type: "trigger", config: { triggerType: "Scheduled" } } },
      ];

      expect(detectTriggerType(nodes)).toBe("scheduled");
    });

    it("should detect Schedule trigger variant", () => {
      const nodes = [
        { data: { type: "trigger", config: { triggerType: "Schedule" } } },
      ];

      expect(detectTriggerType(nodes)).toBe("scheduled");
    });

    it("should default to manual for unknown trigger type", () => {
      const nodes = [
        { data: { type: "trigger", config: { triggerType: "Manual" } } },
      ];

      expect(detectTriggerType(nodes)).toBe("manual");
    });

    it("should default to manual when no trigger node", () => {
      const nodes = [
        { data: { type: "action", config: { actionType: "HTTP Request" } } },
      ];

      expect(detectTriggerType(nodes)).toBe("manual");
    });

    it("should default to manual when trigger has no config", () => {
      const nodes = [{ data: { type: "trigger" } }];

      expect(detectTriggerType(nodes)).toBe("manual");
    });
  });
});
