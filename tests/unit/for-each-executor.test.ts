import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  identifyLoopBody,
  resolveArraySource,
} from "@/lib/workflow-executor.workflow";
import type { WorkflowNode } from "@/lib/workflow-store";

// ---------------------------------------------------------------------------
// Top-level regex patterns (biome: useTopLevelRegex)
// ---------------------------------------------------------------------------

const MULTIPLE_COLLECT_REGEX = /multiple Collect nodes/;
const ARRAY_SOURCE_REQUIRED_REGEX = /arraySource is required/;
const NOT_VALID_TEMPLATE_REGEX = /not a valid template reference/;
const RESOLVED_TO_NULL_REGEX = /resolved to null/;
const MUST_RESOLVE_TO_ARRAY_REGEX = /must resolve to an array/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActionNode(
  id: string,
  actionType: string,
  label?: string
): WorkflowNode {
  return {
    id,
    type: "action",
    position: { x: 0, y: 0 },
    data: {
      label: label ?? actionType,
      type: "action",
      config: { actionType },
    },
  };
}

function buildEdgeMap(edges: [string, string][]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [source, target] of edges) {
    const targets = map.get(source) ?? [];
    targets.push(target);
    map.set(source, targets);
  }
  return map;
}

function buildNodeMap(nodes: WorkflowNode[]): Map<string, WorkflowNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

// ---------------------------------------------------------------------------
// identifyLoopBody
// ---------------------------------------------------------------------------

describe("identifyLoopBody", () => {
  it("finds a simple linear body: ForEach -> A -> Collect", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("c-1", "Collect"),
    ];
    const edges = buildEdgeMap([
      ["fe-1", "a-1"],
      ["a-1", "c-1"],
    ]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBe("c-1");
    expect(result.bodyNodeIds).toEqual(["a-1"]);
    expect(result.bodyEdgesBySource.get("fe-1")).toEqual(["a-1"]);
    expect(result.bodyEdgesBySource.get("a-1")).toEqual(["c-1"]);
  });

  it("finds a branching body: ForEach -> A,B -> Collect", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("b-1", "Execute Code"),
      makeActionNode("c-1", "Collect"),
    ];
    const edges = buildEdgeMap([
      ["fe-1", "a-1"],
      ["fe-1", "b-1"],
      ["a-1", "c-1"],
      ["b-1", "c-1"],
    ]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBe("c-1");
    expect(result.bodyNodeIds).toContain("a-1");
    expect(result.bodyNodeIds).toContain("b-1");
    expect(result.bodyNodeIds).toHaveLength(2);
  });

  it("handles multi-step chain: ForEach -> A -> B -> C -> Collect", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("b-1", "Execute Code"),
      makeActionNode("c-1", "Database Query"),
      makeActionNode("col-1", "Collect"),
    ];
    const edges = buildEdgeMap([
      ["fe-1", "a-1"],
      ["a-1", "b-1"],
      ["b-1", "c-1"],
      ["c-1", "col-1"],
    ]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBe("col-1");
    expect(result.bodyNodeIds).toEqual(["a-1", "b-1", "c-1"]);
  });

  it("returns undefined collectNodeId when no Collect exists", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
    ];
    const edges = buildEdgeMap([["fe-1", "a-1"]]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBeUndefined();
    expect(result.bodyNodeIds).toEqual(["a-1"]);
    expect(result.bodyEdgesBySource.get("fe-1")).toEqual(["a-1"]);
  });

  it("throws when multiple Collect nodes at same depth", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("b-1", "Execute Code"),
      makeActionNode("c-1", "Collect"),
      makeActionNode("c-2", "Collect"),
    ];
    const edges = buildEdgeMap([
      ["fe-1", "a-1"],
      ["fe-1", "b-1"],
      ["a-1", "c-1"],
      ["b-1", "c-2"],
    ]);

    expect(() => identifyLoopBody("fe-1", edges, buildNodeMap(nodes))).toThrow(
      MULTIPLE_COLLECT_REGEX
    );
  });

  it("skips nested ForEach/Collect pairs (depth tracking)", () => {
    // ForEach(outer) -> A -> ForEach(inner) -> B -> Collect(inner) -> C -> Collect(outer)
    const nodes = [
      makeActionNode("fe-outer", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("fe-inner", "For Each"),
      makeActionNode("b-1", "Execute Code"),
      makeActionNode("c-inner", "Collect"),
      makeActionNode("c-1", "Database Query"),
      makeActionNode("c-outer", "Collect"),
    ];
    const edges = buildEdgeMap([
      ["fe-outer", "a-1"],
      ["a-1", "fe-inner"],
      ["fe-inner", "b-1"],
      ["b-1", "c-inner"],
      ["c-inner", "c-1"],
      ["c-1", "c-outer"],
    ]);

    const result = identifyLoopBody("fe-outer", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBe("c-outer");
    // Body should include everything between fe-outer and c-outer
    expect(result.bodyNodeIds).toContain("a-1");
    expect(result.bodyNodeIds).toContain("fe-inner");
    expect(result.bodyNodeIds).toContain("b-1");
    expect(result.bodyNodeIds).toContain("c-inner");
    expect(result.bodyNodeIds).toContain("c-1");
    // But NOT the outer collect itself
    expect(result.bodyNodeIds).not.toContain("c-outer");
  });

  it("handles empty body: ForEach -> Collect directly", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("c-1", "Collect"),
    ];
    const edges = buildEdgeMap([["fe-1", "c-1"]]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBe("c-1");
    expect(result.bodyNodeIds).toEqual([]);
  });

  it("handles ForEach with no outgoing edges (empty body, no Collect)", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("c-1", "Collect"),
    ];
    const edges = buildEdgeMap([]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBeUndefined();
    expect(result.bodyNodeIds).toEqual([]);
  });

  it("identifies full chain as body when no Collect: ForEach -> A -> B", () => {
    const nodes = [
      makeActionNode("fe-1", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("b-1", "Discord"),
    ];
    const edges = buildEdgeMap([
      ["fe-1", "a-1"],
      ["a-1", "b-1"],
    ]);

    const result = identifyLoopBody("fe-1", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBeUndefined();
    expect(result.bodyNodeIds).toEqual(["a-1", "b-1"]);
    expect(result.bodyEdgesBySource.get("fe-1")).toEqual(["a-1"]);
    expect(result.bodyEdgesBySource.get("a-1")).toEqual(["b-1"]);
  });

  it("handles nested ForEach where only inner has Collect", () => {
    const nodes = [
      makeActionNode("fe-outer", "For Each"),
      makeActionNode("fe-inner", "For Each"),
      makeActionNode("a-1", "HTTP Request"),
      makeActionNode("c-inner", "Collect"),
      makeActionNode("b-1", "Discord"),
    ];
    const edges = buildEdgeMap([
      ["fe-outer", "fe-inner"],
      ["fe-inner", "a-1"],
      ["a-1", "c-inner"],
      ["c-inner", "b-1"],
    ]);

    const result = identifyLoopBody("fe-outer", edges, buildNodeMap(nodes));

    expect(result.collectNodeId).toBeUndefined();
    expect(result.bodyNodeIds).toContain("fe-inner");
    expect(result.bodyNodeIds).toContain("a-1");
    expect(result.bodyNodeIds).toContain("c-inner");
    expect(result.bodyNodeIds).toContain("b-1");
  });
});

// ---------------------------------------------------------------------------
// resolveArraySource
// ---------------------------------------------------------------------------

describe("resolveArraySource", () => {
  it("resolves a template reference to an array", () => {
    const outputs = {
      node_1: {
        label: "HTTP Request",
        data: { rows: [1, 2, 3] },
      },
    };

    const result = resolveArraySource("{{@node_1:HTTP Request.rows}}", outputs);
    expect(result).toEqual([1, 2, 3]);
  });

  it("resolves a JSON array literal", () => {
    const result = resolveArraySource('[1, 2, "three"]', {});
    expect(result).toEqual([1, 2, "three"]);
  });

  it("throws when source is empty string", () => {
    expect(() => resolveArraySource("", {})).toThrow(
      ARRAY_SOURCE_REQUIRED_REGEX
    );
  });

  it("throws when source is undefined", () => {
    expect(() => resolveArraySource(undefined, {})).toThrow(
      ARRAY_SOURCE_REQUIRED_REGEX
    );
  });

  it("throws when source is not a valid template or JSON", () => {
    expect(() => resolveArraySource("not-a-template", {})).toThrow(
      NOT_VALID_TEMPLATE_REGEX
    );
  });

  it("throws when template resolves to null", () => {
    const outputs = {
      node_1: {
        label: "HTTP Request",
        data: null,
      },
    };

    expect(() =>
      resolveArraySource("{{@node_1:HTTP Request.rows}}", outputs)
    ).toThrow(RESOLVED_TO_NULL_REGEX);
  });

  it("throws when template resolves to a non-array value", () => {
    const outputs = {
      node_1: {
        label: "HTTP Request",
        data: { rows: "not-an-array" },
      },
    };

    expect(() =>
      resolveArraySource("{{@node_1:HTTP Request.rows}}", outputs)
    ).toThrow(MUST_RESOLVE_TO_ARRAY_REGEX);
  });

  it("resolves top-level data that is itself an array", () => {
    const outputs = {
      node_1: {
        label: "DB Query",
        data: [{ id: 1 }, { id: 2 }],
      },
    };

    const result = resolveArraySource("{{@node_1:DB Query}}", outputs);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("handles node IDs with special characters (sanitized)", () => {
    const outputs = {
      node_1: {
        label: "Step",
        data: { items: ["a", "b"] },
      },
    };

    const result = resolveArraySource("{{@node-1:Step.items}}", outputs);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns empty array from valid empty JSON array", () => {
    const result = resolveArraySource("[]", {});
    expect(result).toEqual([]);
  });

  it("throws for JSON object (not array)", () => {
    expect(() => resolveArraySource('{"key": "value"}', {})).toThrow(
      NOT_VALID_TEMPLATE_REGEX
    );
  });
});
