/**
 * Pure helper functions for grouping For Each execution logs by iteration.
 *
 * Shared by:
 *   - components/workflow/workflow-runs.tsx (UI rendering)
 *   - tests/unit/iteration-grouping.test.ts
 *
 * Uses a generic constraint so callers pass their own log type (e.g., the
 * upstream ExecutionLog) without this module redefining it.
 */

/** Discriminant value for For Each group entries in grouped log output. */
export const FOR_EACH_GROUP_TYPE = "for-each-group" as const;

/** Minimal fields the grouping functions require from a log entry. */
export type IterationLogFields = {
  nodeId: string;
  nodeType: string;
  startedAt: Date;
  iterationIndex: number | null;
  forEachNodeId: string | null;
};

export type IterationGroup<T extends IterationLogFields> = {
  iterationIndex: number;
  logs: T[];
};

export type GroupedLogEntry<T extends IterationLogFields> =
  | { type: "standalone"; log: T }
  | {
      type: typeof FOR_EACH_GROUP_TYPE;
      forEachLog: T;
      iterations: IterationGroup<T>[];
    };

/**
 * Group child logs by iteration index and sort them chronologically.
 */
export function buildIterationGroups<T extends IterationLogFields>(
  childLogs: T[]
): IterationGroup<T>[] {
  const iterationMap = new Map<number, T[]>();
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

/**
 * Transform a flat log array into grouped entries where For Each body
 * node logs are nested under their parent For Each node by iteration.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: grouping logic requires nested conditionals for For Each / Collect classification
export function groupLogsByIteration<T extends IterationLogFields>(
  logs: T[]
): GroupedLogEntry<T>[] {
  const result: GroupedLogEntry<T>[] = [];

  // Collect logs that belong to a For Each loop body (iteration body logs)
  const forEachChildLogs = new Map<string, T[]>();
  for (const log of logs) {
    if (log.forEachNodeId !== null && log.iterationIndex !== null) {
      const existing = forEachChildLogs.get(log.forEachNodeId) ?? [];
      existing.push(log);
      forEachChildLogs.set(log.forEachNodeId, existing);
    }
  }

  // Build grouped entries
  for (const log of logs) {
    // Skip iteration body logs -- they'll be attached to their For Each parent
    if (log.forEachNodeId !== null && log.iterationIndex !== null) {
      continue;
    }

    // For Each parent with child logs: build iteration groups
    if (log.nodeType === "For Each" && forEachChildLogs.has(log.nodeId)) {
      const childLogs = forEachChildLogs.get(log.nodeId) ?? [];
      const iterations = buildIterationGroups(childLogs);
      result.push({
        type: FOR_EACH_GROUP_TYPE,
        forEachLog: log,
        iterations,
      });
    } else {
      result.push({ type: "standalone", log });
    }
  }

  return result;
}
