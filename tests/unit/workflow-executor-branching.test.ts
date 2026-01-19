import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

/**
 * Unit tests for workflow executor condition branching logic
 *
 * Tests cover:
 * 1. Condition nodes with sourceHandle-based branching (new workflows)
 * 2. Condition nodes with legacy edge behavior (backwards compatibility)
 * 3. Edge cases: invalid condition results, mixed edges, multiple branches
 * 4. Non-condition nodes remain unaffected
 */

// Mock server-only to allow importing server modules in tests
vi.mock("server-only", () => ({}));

// Mock the condition step to return controlled results
const mockConditionStep = vi.fn();
vi.mock("@/lib/steps/condition", () => ({
  conditionStep: mockConditionStep,
}));

// Mock the trigger step
const mockTriggerStep = vi.fn();
vi.mock("@/lib/steps/trigger", () => ({
  triggerStep: mockTriggerStep,
}));

// Mock HTTP request step
const mockHttpRequestStep = vi.fn();
vi.mock("@/lib/steps/http-request", () => ({
  httpRequestStep: mockHttpRequestStep,
}));

// Mock metrics
vi.mock("@/keeperhub/lib/metrics", () => ({
  getMetricsCollector: vi.fn(() => ({
    incrementCounter: vi.fn(),
    recordLatency: vi.fn(),
    recordError: vi.fn(),
  })),
  LabelKeys: {},
  MetricNames: {
    WORKFLOW_EXECUTIONS_TOTAL: "workflow_executions_total",
  },
}));

vi.mock("@/keeperhub/lib/metrics/instrumentation/saturation", () => ({
  incrementConcurrentExecutions: vi.fn(),
  decrementConcurrentExecutions: vi.fn(),
}));

vi.mock("@/keeperhub/lib/metrics/instrumentation/workflow", () => ({
  detectTriggerType: vi.fn(() => "webhook"),
  recordWorkflowComplete: vi.fn(),
  recordStepMetrics: vi.fn(),
}));

// Mock condition validator
vi.mock("@/lib/condition-validator", () => ({
  preValidateConditionExpression: vi.fn(() => ({ valid: true })),
  validateConditionExpression: vi.fn(() => ({ valid: true })),
}));

// Mock step registry
vi.mock("@/lib/workflow-executor.workflow", async () => {
  const actual = await vi.importActual("@/lib/workflow-executor.workflow");
  return {
    ...actual,
    getActionLabel: vi.fn((actionType: string) => actionType),
    getStepImporter: vi.fn(),
  };
});

// Mock utils
vi.mock("@/lib/utils", () => ({
  getErrorMessageAsync: vi.fn((error) =>
    Promise.resolve(error instanceof Error ? error.message : String(error))
  ),
}));

describe("Workflow Executor - Condition Branching", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockTriggerStep.mockResolvedValue({
      success: true,
      data: { triggered: true, timestamp: Date.now() },
    });

    // HTTP Request step should return just the data, not a success wrapper
    // The executor wraps it in { success: true, data: ... }
    mockHttpRequestStep.mockResolvedValue({
      status: 200,
      body: "OK",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Condition node with sourceHandle edges (new workflows)", () => {
    it("should execute only true branch when condition is true", async () => {
      // Arrange: condition evaluates to true
      mockConditionStep.mockResolvedValue({
        condition: true,
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "true",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-true",
          type: "action",
          data: {
            type: "action",
            label: "True Branch",
            config: { actionType: "HTTP Request", url: "https://true.example.com" },
          },
          position: { x: 200, y: -50 },
        },
        {
          id: "action-false",
          type: "action",
          data: {
            type: "action",
            label: "False Branch",
            config: { actionType: "HTTP Request", url: "https://false.example.com" },
          },
          position: { x: 200, y: 50 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-true", sourceHandle: "true" },
        { id: "e3", source: "condition-1", target: "action-false", sourceHandle: "false" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      expect(mockHttpRequestStep).toHaveBeenCalledOnce();

      // Verify only the true branch was executed
      const httpCall = mockHttpRequestStep.mock.calls[0][0];
      expect(httpCall.url).toBe("https://true.example.com");
    });

    it("should execute only false branch when condition is false", async () => {
      // Arrange: condition evaluates to false
      mockConditionStep.mockResolvedValue({
        condition: false,
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "false",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-true",
          type: "action",
          data: {
            type: "action",
            label: "True Branch",
            config: { actionType: "HTTP Request", url: "https://true.example.com" },
          },
          position: { x: 200, y: -50 },
        },
        {
          id: "action-false",
          type: "action",
          data: {
            type: "action",
            label: "False Branch",
            config: { actionType: "HTTP Request", url: "https://false.example.com" },
          },
          position: { x: 200, y: 50 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-true", sourceHandle: "true" },
        { id: "e3", source: "condition-1", target: "action-false", sourceHandle: "false" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      expect(mockHttpRequestStep).toHaveBeenCalledOnce();

      // Verify only the false branch was executed
      const httpCall = mockHttpRequestStep.mock.calls[0][0];
      expect(httpCall.url).toBe("https://false.example.com");
    });

  });

  describe("Condition node with legacy edges (backwards compatibility)", () => {
    it("should skip all downstream nodes when condition is false and no sourceHandle", async () => {
      // Arrange: legacy workflow without sourceHandle, condition is false
      mockConditionStep.mockResolvedValue({
        condition: false,
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "false",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-1",
          type: "action",
          data: {
            type: "action",
            label: "Action 1",
            config: { actionType: "HTTP Request", url: "https://action1.example.com" },
          },
          position: { x: 200, y: 0 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-1" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      // Verify no downstream actions were executed (legacy behavior)
      expect(mockHttpRequestStep).not.toHaveBeenCalled();
    });
  });

  describe("Mixed edges scenario", () => {
    it("should use strict matching when some edges have sourceHandle", async () => {
      // Arrange: mixed edges - some with sourceHandle, some without
      // When ANY edge has sourceHandle, we use strict matching mode
      mockConditionStep.mockResolvedValue({
        condition: true,
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "true",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-with-handle",
          type: "action",
          data: {
            type: "action",
            label: "With Handle",
            config: { actionType: "HTTP Request", url: "https://with-handle.example.com" },
          },
          position: { x: 200, y: -50 },
        },
        {
          id: "action-without-handle",
          type: "action",
          data: {
            type: "action",
            label: "Without Handle",
            config: { actionType: "HTTP Request", url: "https://without-handle.example.com" },
          },
          position: { x: 200, y: 50 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-with-handle", sourceHandle: "true" },
        { id: "e3", source: "condition-1", target: "action-without-handle" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      // Only the edge with matching sourceHandle should execute
      expect(mockHttpRequestStep).toHaveBeenCalledOnce();

      const httpCall = mockHttpRequestStep.mock.calls[0][0];
      expect(httpCall.url).toBe("https://with-handle.example.com");
    });
  });

  describe("Invalid condition result", () => {
    it("should not execute any branch when condition returns invalid result", async () => {
      // Arrange: condition returns malformed result
      mockConditionStep.mockResolvedValue({
        invalid: "result",
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "true",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-true",
          type: "action",
          data: {
            type: "action",
            label: "True Branch",
            config: { actionType: "HTTP Request", url: "https://true.example.com" },
          },
          position: { x: 200, y: -50 },
        },
        {
          id: "action-false",
          type: "action",
          data: {
            type: "action",
            label: "False Branch",
            config: { actionType: "HTTP Request", url: "https://false.example.com" },
          },
          position: { x: 200, y: 50 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-true", sourceHandle: "true" },
        { id: "e3", source: "condition-1", target: "action-false", sourceHandle: "false" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      // No branches should execute when condition result is invalid
      expect(mockHttpRequestStep).not.toHaveBeenCalled();
    });

    it("should not execute any branch when condition property is undefined", async () => {
      // Arrange: condition result exists but condition property is undefined
      mockConditionStep.mockResolvedValue({
        condition: undefined,
      });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: {
            type: "trigger",
            label: "Trigger",
            config: { triggerType: "Webhook" },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Check Status",
            config: {
              actionType: "Condition",
              condition: "true",
            },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-true",
          type: "action",
          data: {
            type: "action",
            label: "True Branch",
            config: { actionType: "HTTP Request", url: "https://true.example.com" },
          },
          position: { x: 200, y: -50 },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-true", sourceHandle: "true" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert
      expect(result.success).toBe(true);
      expect(mockConditionStep).toHaveBeenCalledOnce();
      // No branches should execute when condition is undefined
      expect(mockHttpRequestStep).not.toHaveBeenCalled();
    });
  });

  describe("Edge detection logic", () => {
    it("should detect workflow as new when any edge has sourceHandle defined", async () => {
      // Arrange
      mockConditionStep.mockResolvedValue({ condition: true });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: { type: "trigger", label: "Trigger", config: { triggerType: "Webhook" } },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Condition",
            config: { actionType: "Condition", condition: "true" },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-1",
          type: "action",
          data: {
            type: "action",
            label: "Action",
            config: { actionType: "HTTP Request", url: "https://example.com" },
          },
          position: { x: 200, y: 0 },
        },
      ];

      // Edge with sourceHandle defined (even if null, having the property means new workflow)
      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-1", sourceHandle: "true" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert - should use new workflow logic (strict matching)
      expect(result.success).toBe(true);
      expect(mockHttpRequestStep).toHaveBeenCalledOnce();
    });

    it("should detect workflow as legacy when no edges have sourceHandle", async () => {
      // Arrange
      mockConditionStep.mockResolvedValue({ condition: false });

      const nodes: WorkflowNode[] = [
        {
          id: "trigger-1",
          type: "trigger",
          data: { type: "trigger", label: "Trigger", config: { triggerType: "Webhook" } },
          position: { x: 0, y: 0 },
        },
        {
          id: "condition-1",
          type: "action",
          data: {
            type: "action",
            label: "Condition",
            config: { actionType: "Condition", condition: "false" },
          },
          position: { x: 100, y: 0 },
        },
        {
          id: "action-1",
          type: "action",
          data: {
            type: "action",
            label: "Action",
            config: { actionType: "HTTP Request", url: "https://example.com" },
          },
          position: { x: 200, y: 0 },
        },
      ];

      // No sourceHandle property on any edge
      const edges: WorkflowEdge[] = [
        { id: "e1", source: "trigger-1", target: "condition-1" },
        { id: "e2", source: "condition-1", target: "action-1" },
      ];

      // Act
      const { executeWorkflow } = await import("@/lib/workflow-executor.workflow");
      const result = await executeWorkflow({ nodes, edges });

      // Assert - should use legacy logic (skip all when false)
      expect(result.success).toBe(true);
      expect(mockHttpRequestStep).not.toHaveBeenCalled();
    });
  });
});
