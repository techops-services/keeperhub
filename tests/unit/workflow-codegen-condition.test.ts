import { describe, expect, it, vi } from "vitest";

// Mock server-only to allow importing workflow-executor in tests
vi.mock("server-only", () => ({}));

import { generateWorkflowCode } from "@/lib/workflow-codegen";
import { evaluateConditionExpression } from "@/lib/workflow-executor.workflow";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

// Top-level regex patterns for test assertions
const CONDITION_NOT_CONFIGURED_REGEX = /has no condition expression configured/;
const NODE_NOT_FOUND_REGEX = /Condition references node.*no output was found/i;
const FIELD_NOT_EXIST_REGEX = /does not exist on the data/i;
const COULD_NOT_RESOLVE_NULL_REGEX = /could not resolve|null/i;
const COULD_NOT_RESOLVE_UNDEFINED_REGEX = /could not resolve|undefined/i;

/**
 * Tests for KEEP-1284: Conditional will pass when no values are given to it
 *
 * Verifies that condition nodes with empty/unconfigured expressions
 * throw an error during code generation instead of silently defaulting to true.
 */

// Helper to create a minimal trigger node
function createTriggerNode(id: string): WorkflowNode {
  return {
    id,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      label: "Manual Trigger",
      type: "trigger",
      config: { triggerType: "manual" },
    },
  };
}

// Helper to create a condition node (conditions are actions with actionType: "Condition")
function createConditionNode(
  id: string,
  condition: string | undefined
): WorkflowNode {
  return {
    id,
    type: "action",
    position: { x: 0, y: 100 },
    data: {
      label: "Test Condition",
      type: "action",
      config: { actionType: "Condition", condition },
    },
  };
}

// Helper to create an action node
function createActionNode(id: string): WorkflowNode {
  return {
    id,
    type: "action",
    position: { x: 0, y: 200 },
    data: {
      label: "Test Action",
      type: "action",
      config: { actionType: "Send Webhook" },
    },
  };
}

// Helper to create edges
function createEdge(
  source: string,
  target: string,
  sourceHandle?: string
): WorkflowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
  };
}

describe("workflow-codegen condition validation", () => {
  describe("KEEP-1284: empty condition expression handling", () => {
    it("should return validation error when condition expression is undefined", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode("condition-1", undefined),
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-1", "true"),
      ];

      const result = generateWorkflowCode(nodes, edges);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.length).toBeGreaterThan(0);
      expect(result.validationErrors?.[0]).toMatch(
        CONDITION_NOT_CONFIGURED_REGEX
      );
    });

    it("should return validation error when condition expression is empty string", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode("condition-1", ""),
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-1", "true"),
      ];

      const result = generateWorkflowCode(nodes, edges);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.length).toBeGreaterThan(0);
      expect(result.validationErrors?.[0]).toMatch(
        CONDITION_NOT_CONFIGURED_REGEX
      );
    });

    it("should include node label in validation error message", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        {
          id: "condition-1",
          type: "action",
          position: { x: 0, y: 100 },
          data: {
            label: "My Custom Condition",
            type: "action",
            config: { actionType: "Condition", condition: undefined },
          },
        },
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-1", "true"),
      ];

      const result = generateWorkflowCode(nodes, edges);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.[0]).toContain("My Custom Condition");
    });

    it("should succeed when condition expression is valid", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode("condition-1", "true === true"),
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-1", "true"),
      ];

      // Should not throw
      const result = generateWorkflowCode(nodes, edges);
      expect(result).toBeDefined();
      expect(result.code).toContain("if (true === true)");
    });

    it("should succeed with template variable condition", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode(
          "condition-1",
          "{{@trigger-1:Manual Trigger.value}} > 100"
        ),
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-1", "true"),
      ];

      // Should not throw
      const result = generateWorkflowCode(nodes, edges);
      expect(result).toBeDefined();
      expect(result.code).toContain("> 100");
    });
  });

  describe("condition with both true and false branches", () => {
    it("should return validation error for empty condition with both branches", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode("condition-1", undefined),
        createActionNode("action-true"),
        createActionNode("action-false"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "action-true", "true"),
        createEdge("condition-1", "action-false", "false"),
      ];

      const result = generateWorkflowCode(nodes, edges);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.[0]).toMatch(
        CONDITION_NOT_CONFIGURED_REGEX
      );
    });
  });

  describe("nested conditions", () => {
    it("should return validation error for empty nested condition", () => {
      const nodes: WorkflowNode[] = [
        createTriggerNode("trigger-1"),
        createConditionNode("condition-1", "true"),
        createConditionNode("condition-2", undefined),
        createActionNode("action-1"),
      ];

      const edges: WorkflowEdge[] = [
        createEdge("trigger-1", "condition-1"),
        createEdge("condition-1", "condition-2", "true"),
        createEdge("condition-2", "action-1", "true"),
      ];

      const result = generateWorkflowCode(nodes, edges);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.[0]).toMatch(
        CONDITION_NOT_CONFIGURED_REGEX
      );
    });
  });
});

/**
 * Runtime condition evaluation tests
 *
 * Tests for KEEP-1284: Conditions should throw error when referenced data is missing
 * instead of silently evaluating to false.
 */
describe("runtime condition evaluation", () => {
  describe("KEEP-1284: missing data should throw error", () => {
    it("should throw error when referenced node output does not exist", () => {
      const expression = "{{@nonExistentNode:Label.value}} > 100";
      const outputs = {}; // No outputs available

      expect(() => evaluateConditionExpression(expression, outputs)).toThrow(
        NODE_NOT_FOUND_REGEX
      );
    });

    it("should throw error when referenced field is undefined", () => {
      const expression = "{{@node1:Label.missingField}} > 100";
      const outputs = {
        node1: { label: "Label", data: { existingField: 42 } },
      };

      expect(() => evaluateConditionExpression(expression, outputs)).toThrow(
        FIELD_NOT_EXIST_REGEX
      );
    });

    it("should throw error when node data is null", () => {
      const expression = "{{@node1:Label.value}} > 100";
      const outputs = {
        node1: { label: "Label", data: null },
      };

      expect(() => evaluateConditionExpression(expression, outputs)).toThrow(
        COULD_NOT_RESOLVE_NULL_REGEX
      );
    });

    it("should throw error when node data is undefined", () => {
      const expression = "{{@node1:Label.value}} > 100";
      const outputs = {
        node1: { label: "Label", data: undefined },
      };

      expect(() => evaluateConditionExpression(expression, outputs)).toThrow(
        COULD_NOT_RESOLVE_UNDEFINED_REGEX
      );
    });

    it("should succeed when all referenced data exists", () => {
      const expression = "{{@node1:Label.value}} > 100";
      const outputs = {
        node1: { label: "Label", data: { value: 150 } },
      };

      const result = evaluateConditionExpression(expression, outputs);
      expect(result.result).toBe(true);
      expect(result.resolvedValues).toHaveProperty("Label.value", 150);
    });

    it("should succeed when comparing to zero (falsy but valid)", () => {
      const expression = "{{@node1:Label.count}} === 0";
      const outputs = {
        node1: { label: "Label", data: { count: 0 } },
      };

      const result = evaluateConditionExpression(expression, outputs);
      expect(result.result).toBe(true);
    });

    it("should succeed when comparing to empty string (falsy but valid)", () => {
      const expression = "{{@node1:Label.name}} === ''";
      const outputs = {
        node1: { label: "Label", data: { name: "" } },
      };

      const result = evaluateConditionExpression(expression, outputs);
      expect(result.result).toBe(true);
    });

    it("should resolve nested array path (data.carts[0].products[0].id)", () => {
      const expression =
        "{{@node1:API.data.carts[0].products[0].id}} === 'prod-1'";
      const outputs = {
        node1: {
          label: "API",
          data: {
            data: {
              carts: [{ products: [{ id: "prod-1" }, { id: "prod-2" }] }],
              total: 1,
              skip: 0,
              limit: 10,
            },
          },
        },
      };

      const result = evaluateConditionExpression(expression, outputs);
      expect(result.result).toBe(true);
      expect(result.resolvedValues).toHaveProperty(
        "API.data.carts[0].products[0].id",
        "prod-1"
      );
    });
  });
});
