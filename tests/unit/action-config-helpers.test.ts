import { describe, expect, it } from "vitest";

/**
 * Re-implementations of pure helper functions from
 * components/workflow/config/action-config.tsx for isolated unit testing.
 */

const ARRAY_SOURCE_RE = /^\{\{@([^:]+):([^.}]+)\.?([^}]*)\}\}$/;

function extractObjectPaths(
  obj: Record<string, unknown>,
  prefix: string,
  depth: number,
  paths: string[]
): void {
  if (depth > 3) {
    return;
  }
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      extractObjectPaths(
        val as Record<string, unknown>,
        path,
        depth + 1,
        paths
      );
    }
  }
}

function traverseFieldPath(root: unknown, fieldPath: string): unknown {
  let data: unknown = root;
  for (const part of fieldPath.split(".")) {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      data = (data as Record<string, unknown>)[part];
      if (data === undefined) {
        return null;
      }
    } else {
      return null;
    }
  }
  return data;
}

function resolveArraySourceElement(
  arraySource: string,
  executionLogs: Record<string, { output?: unknown }>,
  lastLogs: Record<string, { output?: unknown }>
): Record<string, unknown> | null {
  const match = ARRAY_SOURCE_RE.exec(arraySource);
  if (!match) {
    return null;
  }

  const sourceNodeId = match[1];
  const fieldPath = match[3] || "";

  const sourceOutput =
    executionLogs[sourceNodeId]?.output ?? lastLogs[sourceNodeId]?.output;
  if (sourceOutput == null) {
    return null;
  }

  const data = fieldPath
    ? traverseFieldPath(sourceOutput, fieldPath)
    : sourceOutput;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return null;
  }

  return first as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("action-config helpers", () => {
  // -----------------------------------------------------------------------
  // ARRAY_SOURCE_RE
  // -----------------------------------------------------------------------
  describe("ARRAY_SOURCE_RE", () => {
    it("matches standard template and extracts nodeId, label, fieldPath", () => {
      const match = ARRAY_SOURCE_RE.exec("{{@node_1:Label.field}}");
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("node_1");
      expect(match?.[2]).toBe("Label");
      expect(match?.[3]).toBe("field");
    });

    it("matches template without field path", () => {
      const match = ARRAY_SOURCE_RE.exec("{{@node_1:Label}}");
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("node_1");
      expect(match?.[2]).toBe("Label");
      expect(match?.[3]).toBe("");
    });

    it("matches template with nested field path", () => {
      const match = ARRAY_SOURCE_RE.exec("{{@node_1:Label.data.items}}");
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("node_1");
      expect(match?.[2]).toBe("Label");
      expect(match?.[3]).toBe("data.items");
    });

    it("does not match plain text", () => {
      expect(ARRAY_SOURCE_RE.exec("hello world")).toBeNull();
    });

    it("does not match incomplete templates", () => {
      expect(ARRAY_SOURCE_RE.exec("{{@node_1")).toBeNull();
      expect(ARRAY_SOURCE_RE.exec("{{node_1:Label.field}}")).toBeNull();
      expect(ARRAY_SOURCE_RE.exec("@node_1:Label.field}}")).toBeNull();
      expect(ARRAY_SOURCE_RE.exec("{{@:Label.field}}")).toBeNull();
    });

    it("handles node IDs with hyphens", () => {
      const match = ARRAY_SOURCE_RE.exec("{{@node-1:Label.field}}");
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("node-1");
      expect(match?.[2]).toBe("Label");
      expect(match?.[3]).toBe("field");
    });
  });

  // -----------------------------------------------------------------------
  // extractObjectPaths
  // -----------------------------------------------------------------------
  describe("extractObjectPaths", () => {
    it("returns no paths for an empty object", () => {
      const paths: string[] = [];
      extractObjectPaths({}, "", 0, paths);
      expect(paths).toEqual([]);
    });

    it("returns top-level keys for a flat object with primitive values", () => {
      const paths: string[] = [];
      extractObjectPaths({ a: 1, b: "two", c: true }, "", 0, paths);
      expect(paths).toEqual(["a", "b", "c"]);
    });

    it("returns both parent and child paths with dot notation for nested objects", () => {
      const paths: string[] = [];
      extractObjectPaths({ a: { b: 1 } }, "", 0, paths);
      expect(paths).toEqual(["a", "a.b"]);
    });

    it("stops recursing beyond depth 3", () => {
      const paths: string[] = [];
      const obj = { l1: { l2: { l3: { l4: { l5: "deep" } } } } };
      extractObjectPaths(obj, "", 0, paths);

      // depth 0 -> l1 (recurse into l1 at depth 1)
      // depth 1 -> l1.l2 (recurse into l2 at depth 2)
      // depth 2 -> l1.l2.l3 (recurse into l3 at depth 3)
      // depth 3 -> l1.l2.l3.l4 (depth > 3 check fails at depth 4, so no recurse)
      // l4 key is still added, but l5 inside l4 is not reached
      expect(paths).toContain("l1");
      expect(paths).toContain("l1.l2");
      expect(paths).toContain("l1.l2.l3");
      expect(paths).toContain("l1.l2.l3.l4");
      expect(paths).not.toContain("l1.l2.l3.l4.l5");
    });

    it("includes array keys but does not recurse into arrays", () => {
      const paths: string[] = [];
      extractObjectPaths({ items: [1, 2, 3] }, "", 0, paths);
      // The key "items" is added, but since the value is an array it is not recursed
      expect(paths).toEqual(["items"]);
    });

    it("handles deeply nested objects (4+ levels) and only shows up to depth 3", () => {
      const paths: string[] = [];
      const obj = {
        a: {
          b: {
            c: {
              d: {
                e: "value",
              },
            },
          },
        },
      };
      extractObjectPaths(obj, "", 0, paths);
      expect(paths).toEqual(["a", "a.b", "a.b.c", "a.b.c.d"]);
    });

    it("handles mixed types: strings, numbers, booleans, null, arrays, objects", () => {
      const paths: string[] = [];
      const obj = {
        str: "hello",
        num: 42,
        bool: false,
        nil: null,
        arr: [1, 2],
        nested: { inner: "val" },
      };
      extractObjectPaths(obj, "", 0, paths);
      expect(paths).toEqual([
        "str",
        "num",
        "bool",
        "nil",
        "arr",
        "nested",
        "nested.inner",
      ]);
    });

    it("respects a non-empty prefix", () => {
      const paths: string[] = [];
      extractObjectPaths({ x: 1 }, "root", 0, paths);
      expect(paths).toEqual(["root.x"]);
    });
  });

  // -----------------------------------------------------------------------
  // traverseFieldPath
  // -----------------------------------------------------------------------
  describe("traverseFieldPath", () => {
    it("returns the value for a single key", () => {
      expect(traverseFieldPath({ a: 1 }, "a")).toBe(1);
    });

    it("returns the value for a nested path", () => {
      expect(traverseFieldPath({ a: { b: 2 } }, "a.b")).toBe(2);
    });

    it("returns undefined for a missing key at the last level", () => {
      expect(traverseFieldPath({ a: 1 }, "b")).toBeNull();
    });

    it("returns null when an array is encountered along the path", () => {
      expect(traverseFieldPath({ a: [1, 2] }, "a.0")).toBeNull();
    });

    it("returns null for a null root", () => {
      expect(traverseFieldPath(null, "a")).toBeNull();
    });

    it("returns null for an undefined root", () => {
      expect(traverseFieldPath(undefined, "a")).toBeNull();
    });

    it("traverses deep nested paths (a.b.c.d)", () => {
      const obj = { a: { b: { c: { d: "found" } } } };
      expect(traverseFieldPath(obj, "a.b.c.d")).toBe("found");
    });

    it("returns null when a mid-level key is missing", () => {
      expect(traverseFieldPath({ a: { b: 1 } }, "a.x.y")).toBeNull();
    });

    it("returns the nested object when path stops at an intermediate level", () => {
      const obj = { a: { b: { c: 3 } } };
      expect(traverseFieldPath(obj, "a.b")).toEqual({ c: 3 });
    });
  });

  // -----------------------------------------------------------------------
  // resolveArraySourceElement
  // -----------------------------------------------------------------------
  describe("resolveArraySourceElement", () => {
    const emptyLogs: Record<string, { output?: unknown }> = {};

    it("returns null for a non-template string", () => {
      expect(
        resolveArraySourceElement("plain text", emptyLogs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when source node is not in any logs", () => {
      const result = resolveArraySourceElement(
        "{{@node_1:Label.items}}",
        {},
        {}
      );
      expect(result).toBeNull();
    });

    it("returns null when output is null", () => {
      const logs = { node_1: { output: null } };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when output is undefined", () => {
      const logs = { node_1: { output: undefined } };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when resolved data is not an array", () => {
      const logs = { node_1: { output: { items: "not-an-array" } } };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when the array is empty", () => {
      const logs = { node_1: { output: { items: [] } } };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when the first element is a primitive (not object)", () => {
      const logs = { node_1: { output: { items: [42, 43] } } };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns null when the first element is an array (not plain object)", () => {
      const logs = {
        node_1: {
          output: {
            items: [
              [1, 2],
              [3, 4],
            ],
          },
        },
      };
      expect(
        resolveArraySourceElement("{{@node_1:Label.items}}", logs, emptyLogs)
      ).toBeNull();
    });

    it("returns the first element of the array (happy path with field path)", () => {
      const logs = {
        node_1: {
          output: {
            items: [
              { id: 1, name: "first" },
              { id: 2, name: "second" },
            ],
          },
        },
      };
      const result = resolveArraySourceElement(
        "{{@node_1:Label.items}}",
        logs,
        emptyLogs
      );
      expect(result).toEqual({ id: 1, name: "first" });
    });

    it("works without field path when output is directly an array", () => {
      const logs = {
        node_1: {
          output: [
            { id: 1, name: "first" },
            { id: 2, name: "second" },
          ],
        },
      };
      const result = resolveArraySourceElement(
        "{{@node_1:Label}}",
        logs,
        emptyLogs
      );
      expect(result).toEqual({ id: 1, name: "first" });
    });

    it("falls back to lastLogs when not in executionLogs", () => {
      const lastLogs = {
        node_1: {
          output: {
            items: [{ id: 99, name: "from-last" }],
          },
        },
      };
      const result = resolveArraySourceElement(
        "{{@node_1:Label.items}}",
        {},
        lastLogs
      );
      expect(result).toEqual({ id: 99, name: "from-last" });
    });

    it("prefers executionLogs over lastLogs", () => {
      const executionLogs = {
        node_1: {
          output: {
            items: [{ id: 1, source: "execution" }],
          },
        },
      };
      const lastLogs = {
        node_1: {
          output: {
            items: [{ id: 2, source: "last" }],
          },
        },
      };
      const result = resolveArraySourceElement(
        "{{@node_1:Label.items}}",
        executionLogs,
        lastLogs
      );
      expect(result).toEqual({ id: 1, source: "execution" });
    });
  });
});
