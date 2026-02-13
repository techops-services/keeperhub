import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types (mirrored from components/workflow/workflow-runs.tsx)
// ---------------------------------------------------------------------------

type ExecutionLog = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "pending" | "running" | "success" | "error";
  startedAt: Date;
  completedAt: Date | null;
  duration: string | null;
  input?: unknown;
  output?: unknown;
  error: string | null;
  iterationIndex: number | null;
  forEachNodeId: string | null;
};

type IterationGroup = {
  iterationIndex: number;
  logs: ExecutionLog[];
};

type GroupedLogEntry =
  | { type: "standalone"; log: ExecutionLog }
  | {
      type: "for-each-group";
      forEachLog: ExecutionLog;
      iterations: IterationGroup[];
    };

// ---------------------------------------------------------------------------
// Functions under test (copied from components/workflow/workflow-runs.tsx)
// ---------------------------------------------------------------------------

function buildIterationGroups(childLogs: ExecutionLog[]): IterationGroup[] {
  const iterationMap = new Map<number, ExecutionLog[]>();
  for (const child of childLogs) {
    const idx = child.iterationIndex ?? 0;
    const existing = iterationMap.get(idx) ?? [];
    existing.push(child);
    iterationMap.set(idx, existing);
  }

  return Array.from(iterationMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, iterLogs]) => ({
      iterationIndex: index,
      logs: iterLogs.sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      ),
    }));
}

function groupLogsByIteration(logs: ExecutionLog[]): GroupedLogEntry[] {
  const result: GroupedLogEntry[] = [];

  const forEachChildLogs = new Map<string, ExecutionLog[]>();
  for (const log of logs) {
    if (log.forEachNodeId !== null && log.iterationIndex !== null) {
      const existing = forEachChildLogs.get(log.forEachNodeId) ?? [];
      existing.push(log);
      forEachChildLogs.set(log.forEachNodeId, existing);
    }
  }

  for (const log of logs) {
    if (log.forEachNodeId !== null && log.iterationIndex !== null) {
      continue;
    }

    if (log.nodeType === "For Each" && forEachChildLogs.has(log.nodeId)) {
      const childLogs = forEachChildLogs.get(log.nodeId) ?? [];
      const iterations = buildIterationGroups(childLogs);
      result.push({ type: "for-each-group", forEachLog: log, iterations });
    } else {
      result.push({ type: "standalone", log });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let logCounter = 0;

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  logCounter += 1;
  return {
    id: `log-${logCounter}`,
    nodeId: `node-${logCounter}`,
    nodeName: `Node ${logCounter}`,
    nodeType: "action",
    status: "success",
    startedAt: new Date("2025-01-01T00:00:00Z"),
    completedAt: new Date("2025-01-01T00:00:01Z"),
    duration: "1s",
    input: undefined,
    output: undefined,
    error: null,
    iterationIndex: null,
    forEachNodeId: null,
    ...overrides,
  };
}

// Reset the counter before each test suite to keep IDs deterministic
// within each describe block (not strictly required, but keeps things tidy).

// ---------------------------------------------------------------------------
// buildIterationGroups
// ---------------------------------------------------------------------------

describe("buildIterationGroups", () => {
  it("returns an empty array for empty input", () => {
    const result = buildIterationGroups([]);
    expect(result).toEqual([]);
  });

  it("returns a single iteration with one log", () => {
    const log = makeLog({ iterationIndex: 0 });
    const result = buildIterationGroups([log]);

    expect(result).toHaveLength(1);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[0].logs).toEqual([log]);
  });

  it("groups multiple logs into a single iteration sorted by startedAt", () => {
    const logA = makeLog({
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:03Z"),
      nodeName: "Step C",
    });
    const logB = makeLog({
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:01Z"),
      nodeName: "Step A",
    });
    const logC = makeLog({
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:02Z"),
      nodeName: "Step B",
    });

    const result = buildIterationGroups([logA, logB, logC]);

    expect(result).toHaveLength(1);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[0].logs).toEqual([logB, logC, logA]);
  });

  it("returns multiple iterations sorted by iterationIndex", () => {
    const log0 = makeLog({ iterationIndex: 0 });
    const log1 = makeLog({ iterationIndex: 1 });
    const log2 = makeLog({ iterationIndex: 2 });

    const result = buildIterationGroups([log0, log1, log2]);

    expect(result).toHaveLength(3);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[1].iterationIndex).toBe(1);
    expect(result[2].iterationIndex).toBe(2);
  });

  it("defaults null iterationIndex to 0", () => {
    const logWithNull = makeLog({ iterationIndex: null });
    const logWithZero = makeLog({ iterationIndex: 0 });

    const result = buildIterationGroups([logWithNull, logWithZero]);

    expect(result).toHaveLength(1);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[0].logs).toHaveLength(2);
    expect(result[0].logs).toContain(logWithNull);
    expect(result[0].logs).toContain(logWithZero);
  });

  it("sorts out-of-order iterations by iterationIndex", () => {
    const log2 = makeLog({ iterationIndex: 2 });
    const log0 = makeLog({ iterationIndex: 0 });
    const log5 = makeLog({ iterationIndex: 5 });
    const log1 = makeLog({ iterationIndex: 1 });

    const result = buildIterationGroups([log2, log0, log5, log1]);

    expect(result.map((g) => g.iterationIndex)).toEqual([0, 1, 2, 5]);
  });

  it("sorts out-of-order logs within the same iteration by startedAt", () => {
    const late = makeLog({
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:05:00Z"),
    });
    const early = makeLog({
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:01:00Z"),
    });
    const middle = makeLog({
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:03:00Z"),
    });

    const result = buildIterationGroups([late, early, middle]);

    expect(result).toHaveLength(1);
    expect(result[0].logs[0]).toBe(early);
    expect(result[0].logs[1]).toBe(middle);
    expect(result[0].logs[2]).toBe(late);
  });

  it("handles multiple iterations each with multiple logs", () => {
    const iter0a = makeLog({
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:02Z"),
    });
    const iter0b = makeLog({
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:01Z"),
    });
    const iter1a = makeLog({
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:00:04Z"),
    });
    const iter1b = makeLog({
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:00:03Z"),
    });

    const result = buildIterationGroups([iter0a, iter1a, iter0b, iter1b]);

    expect(result).toHaveLength(2);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[0].logs).toEqual([iter0b, iter0a]);
    expect(result[1].iterationIndex).toBe(1);
    expect(result[1].logs).toEqual([iter1b, iter1a]);
  });
});

// ---------------------------------------------------------------------------
// groupLogsByIteration
// ---------------------------------------------------------------------------

describe("groupLogsByIteration", () => {
  it("returns an empty array for empty input", () => {
    const result = groupLogsByIteration([]);
    expect(result).toEqual([]);
  });

  it("treats all logs as standalone when none are For Each related", () => {
    const logA = makeLog({ nodeType: "action", nodeName: "HTTP Request" });
    const logB = makeLog({ nodeType: "action", nodeName: "Send Email" });

    const result = groupLogsByIteration([logA, logB]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "standalone", log: logA });
    expect(result[1]).toEqual({ type: "standalone", log: logB });
  });

  it("groups a For Each node with its body logs into iterations", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
      nodeName: "Loop Over Items",
    });
    const bodyLog0 = makeLog({
      nodeId: "body-1",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:01Z"),
    });
    const bodyLog1 = makeLog({
      nodeId: "body-2",
      forEachNodeId: "fe-1",
      iterationIndex: 1,
      startedAt: new Date("2025-01-01T00:00:02Z"),
    });

    const result = groupLogsByIteration([forEachLog, bodyLog0, bodyLog1]);

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.type).toBe("for-each-group");
    if (entry.type === "for-each-group") {
      expect(entry.forEachLog).toBe(forEachLog);
      expect(entry.iterations).toHaveLength(2);
      expect(entry.iterations[0].iterationIndex).toBe(0);
      expect(entry.iterations[0].logs).toEqual([bodyLog0]);
      expect(entry.iterations[1].iterationIndex).toBe(1);
      expect(entry.iterations[1].logs).toEqual([bodyLog1]);
    }
  });

  it("treats a For Each log with no child logs as standalone", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
      nodeName: "Loop (no children)",
    });

    const result = groupLogsByIteration([forEachLog]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "standalone", log: forEachLog });
  });

  it("handles mixed standalone and For Each entries", () => {
    const standaloneA = makeLog({
      nodeId: "s-1",
      nodeType: "action",
      nodeName: "Pre-step",
    });
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
      nodeName: "Loop",
    });
    const bodyLog = makeLog({
      nodeId: "body-1",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
    });
    const standaloneB = makeLog({
      nodeId: "s-2",
      nodeType: "action",
      nodeName: "Post-step",
    });

    const result = groupLogsByIteration([
      standaloneA,
      forEachLog,
      bodyLog,
      standaloneB,
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("standalone");
    expect(result[1].type).toBe("for-each-group");
    expect(result[2].type).toBe("standalone");

    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(standaloneA);
    }
    if (result[1].type === "for-each-group") {
      expect(result[1].forEachLog).toBe(forEachLog);
      expect(result[1].iterations).toHaveLength(1);
      expect(result[1].iterations[0].logs).toEqual([bodyLog]);
    }
    if (result[2].type === "standalone") {
      expect(result[2].log).toBe(standaloneB);
    }
  });

  it("handles multiple For Each groups in the same execution", () => {
    const fe1 = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
      nodeName: "Loop 1",
    });
    const fe1Body = makeLog({
      nodeId: "b1",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
    });
    const fe2 = makeLog({
      nodeId: "fe-2",
      nodeType: "For Each",
      nodeName: "Loop 2",
    });
    const fe2Body = makeLog({
      nodeId: "b2",
      forEachNodeId: "fe-2",
      iterationIndex: 0,
    });

    const result = groupLogsByIteration([fe1, fe1Body, fe2, fe2Body]);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("for-each-group");
    expect(result[1].type).toBe("for-each-group");

    if (result[0].type === "for-each-group") {
      expect(result[0].forEachLog).toBe(fe1);
      expect(result[0].iterations[0].logs).toEqual([fe1Body]);
    }
    if (result[1].type === "for-each-group") {
      expect(result[1].forEachLog).toBe(fe2);
      expect(result[1].iterations[0].logs).toEqual([fe2Body]);
    }
  });

  it("treats logs with null iterationIndex and null forEachNodeId as standalone", () => {
    const log = makeLog({
      iterationIndex: null,
      forEachNodeId: null,
      nodeType: "action",
    });

    const result = groupLogsByIteration([log]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("standalone");
    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(log);
    }
  });

  it("does not duplicate body logs - they appear only in iterations, not as standalone", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
    });
    const bodyA = makeLog({
      nodeId: "body-a",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
    });
    const bodyB = makeLog({
      nodeId: "body-b",
      forEachNodeId: "fe-1",
      iterationIndex: 1,
    });

    const result = groupLogsByIteration([forEachLog, bodyA, bodyB]);

    // Only one entry: the for-each-group. Body logs are NOT standalone.
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("for-each-group");

    // Verify no standalone entries exist for the body logs
    const standaloneEntries = result.filter((e) => e.type === "standalone");
    expect(standaloneEntries).toHaveLength(0);
  });

  it("treats a For Each node with nodeType 'For Each' but no matching children as standalone", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
    });
    // No child logs reference fe-1

    const result = groupLogsByIteration([forEachLog]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("standalone");
    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(forEachLog);
    }
  });

  it("preserves original order of standalone logs", () => {
    const logA = makeLog({ nodeType: "action", nodeName: "Step 1" });
    const logB = makeLog({ nodeType: "action", nodeName: "Step 2" });
    const logC = makeLog({ nodeType: "action", nodeName: "Step 3" });
    const logD = makeLog({ nodeType: "action", nodeName: "Step 4" });

    const result = groupLogsByIteration([logA, logB, logC, logD]);

    expect(result).toHaveLength(4);
    for (const [i, entry] of result.entries()) {
      expect(entry.type).toBe("standalone");
      if (entry.type === "standalone") {
        expect(entry.log).toBe([logA, logB, logC, logD][i]);
      }
    }
  });

  it("treats a log with forEachNodeId set but iterationIndex null as standalone", () => {
    const edgeCase = makeLog({
      nodeId: "orphan-1",
      forEachNodeId: "fe-1",
      iterationIndex: null,
      nodeType: "action",
    });

    const result = groupLogsByIteration([edgeCase]);

    // forEachNodeId is set but iterationIndex is null, so the child-detection
    // condition (both non-null) is NOT met. This log is standalone.
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("standalone");
    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(edgeCase);
    }
  });

  it("treats a log with iterationIndex set but forEachNodeId null as standalone", () => {
    const edgeCase = makeLog({
      nodeId: "orphan-2",
      iterationIndex: 3,
      forEachNodeId: null,
      nodeType: "action",
    });

    const result = groupLogsByIteration([edgeCase]);

    // iterationIndex is set but forEachNodeId is null, so the child-detection
    // condition (both non-null) is NOT met. This log is standalone.
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("standalone");
    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(edgeCase);
    }
  });

  it("groups multiple body steps within the same iteration correctly", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
    });
    const stepA = makeLog({
      nodeId: "step-a",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:01Z"),
    });
    const stepB = makeLog({
      nodeId: "step-b",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:02Z"),
    });
    const stepC = makeLog({
      nodeId: "step-c",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
      startedAt: new Date("2025-01-01T00:00:03Z"),
    });

    const result = groupLogsByIteration([forEachLog, stepA, stepB, stepC]);

    expect(result).toHaveLength(1);
    if (result[0].type === "for-each-group") {
      expect(result[0].iterations).toHaveLength(1);
      expect(result[0].iterations[0].logs).toEqual([stepA, stepB, stepC]);
    }
  });

  it("correctly handles body logs appearing before the For Each log in the array", () => {
    // The function processes all logs in two passes: first collecting children,
    // then building groups. Order in the input array should not matter.
    const bodyLog = makeLog({
      nodeId: "body-1",
      forEachNodeId: "fe-1",
      iterationIndex: 0,
    });
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
    });

    const result = groupLogsByIteration([bodyLog, forEachLog]);

    // Body log is skipped in the second pass, For Each is grouped
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("for-each-group");
    if (result[0].type === "for-each-group") {
      expect(result[0].forEachLog).toBe(forEachLog);
      expect(result[0].iterations[0].logs).toEqual([bodyLog]);
    }
  });

  it("correctly handles a For Each with many iterations and many body steps", () => {
    const forEachLog = makeLog({
      nodeId: "fe-1",
      nodeType: "For Each",
    });

    const bodyLogs: ExecutionLog[] = [];
    for (let iteration = 0; iteration < 5; iteration++) {
      for (let step = 0; step < 3; step++) {
        bodyLogs.push(
          makeLog({
            nodeId: `step-${step}`,
            forEachNodeId: "fe-1",
            iterationIndex: iteration,
            startedAt: new Date(`2025-01-01T00:0${iteration}:0${step}Z`),
          })
        );
      }
    }

    const result = groupLogsByIteration([forEachLog, ...bodyLogs]);

    expect(result).toHaveLength(1);
    if (result[0].type === "for-each-group") {
      expect(result[0].iterations).toHaveLength(5);
      for (const group of result[0].iterations) {
        expect(group.logs).toHaveLength(3);
      }
      // Verify iteration ordering
      const indices = result[0].iterations.map((g) => g.iterationIndex);
      expect(indices).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("does not treat a non-For-Each node as a group even if children reference it", () => {
    // A log with nodeType "action" that has children referencing it via forEachNodeId
    // should NOT be treated as a for-each-group because its nodeType is not "For Each"
    const actionLog = makeLog({
      nodeId: "action-1",
      nodeType: "action",
      nodeName: "Regular Action",
    });
    const childLog = makeLog({
      nodeId: "child-1",
      forEachNodeId: "action-1",
      iterationIndex: 0,
    });

    const result = groupLogsByIteration([actionLog, childLog]);

    // actionLog is standalone because nodeType is not "For Each"
    // childLog is skipped (has both forEachNodeId and iterationIndex)
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("standalone");
    if (result[0].type === "standalone") {
      expect(result[0].log).toBe(actionLog);
    }
  });
});
