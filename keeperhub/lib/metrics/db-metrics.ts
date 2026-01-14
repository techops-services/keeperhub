/**
 * Database-backed Metrics Collection
 *
 * Queries execution statistics from the database and exposes them as Prometheus metrics.
 * This is necessary because workflow runner jobs exit before Prometheus can scrape them.
 *
 * These metrics are collected on each /api/metrics scrape to ensure fresh data.
 */

import "server-only";

import { and, count, countDistinct, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  sessions,
  workflowExecutionLogs,
  workflowExecutions,
} from "@/lib/db/schema";

// Histogram bucket boundaries in milliseconds (must match prometheus.ts)
const WORKFLOW_DURATION_BUCKETS = [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000];
const STEP_DURATION_BUCKETS = [50, 100, 250, 500, 1000, 2000, 5000];

export type WorkflowStats = {
  // Total executions by status
  totalSuccess: number;
  totalError: number;
  totalRunning: number;
  totalPending: number;

  // Duration histogram data (count of executions in each bucket)
  durationBuckets: number[];
  durationSum: number;
  durationCount: number;
};

/**
 * Query workflow execution statistics from the database
 *
 * Returns counts and duration distribution for all completed executions.
 * This data is used to populate Prometheus metrics on each scrape.
 */
export async function getWorkflowStatsFromDb(): Promise<WorkflowStats> {
  try {
    // Query execution counts by status
    const statusCounts = await db
      .select({
        status: workflowExecutions.status,
        count: count(),
      })
      .from(workflowExecutions)
      .groupBy(workflowExecutions.status);

    const stats: WorkflowStats = {
      totalSuccess: 0,
      totalError: 0,
      totalRunning: 0,
      totalPending: 0,
      durationBuckets: new Array(WORKFLOW_DURATION_BUCKETS.length + 1).fill(0),
      durationSum: 0,
      durationCount: 0,
    };

    for (const row of statusCounts) {
      switch (row.status) {
        case "success":
          stats.totalSuccess = row.count;
          break;
        case "error":
          stats.totalError = row.count;
          break;
        case "running":
          stats.totalRunning = row.count;
          break;
        case "pending":
          stats.totalPending = row.count;
          break;
      }
    }

    // Query duration histogram data for completed executions
    // Build bucket counts using SQL CASE statements for efficiency
    const durationQuery = await db
      .select({
        totalCount: count(),
        totalSum: sql<number>`COALESCE(SUM(CAST(${workflowExecutions.duration} AS INTEGER)), 0)`,
        // Count executions in each bucket (cumulative)
        bucket0: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 100 THEN 1 ELSE 0 END)`,
        bucket1: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 250 THEN 1 ELSE 0 END)`,
        bucket2: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 500 THEN 1 ELSE 0 END)`,
        bucket3: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 1000 THEN 1 ELSE 0 END)`,
        bucket4: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 2000 THEN 1 ELSE 0 END)`,
        bucket5: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 5000 THEN 1 ELSE 0 END)`,
        bucket6: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 10000 THEN 1 ELSE 0 END)`,
        bucket7: sql<number>`SUM(CASE WHEN CAST(${workflowExecutions.duration} AS INTEGER) <= 30000 THEN 1 ELSE 0 END)`,
      })
      .from(workflowExecutions)
      .where(
        and(
          sql`${workflowExecutions.status} IN ('success', 'error')`,
          sql`${workflowExecutions.duration} IS NOT NULL`
        )
      );

    if (durationQuery[0]) {
      const row = durationQuery[0];
      stats.durationCount = Number(row.totalCount) || 0;
      stats.durationSum = Number(row.totalSum) || 0;
      stats.durationBuckets = [
        Number(row.bucket0) || 0,
        Number(row.bucket1) || 0,
        Number(row.bucket2) || 0,
        Number(row.bucket3) || 0,
        Number(row.bucket4) || 0,
        Number(row.bucket5) || 0,
        Number(row.bucket6) || 0,
        Number(row.bucket7) || 0,
        stats.durationCount, // +Inf bucket = total count
      ];
    }

    return stats;
  } catch (error) {
    console.error("[Metrics] Failed to query workflow stats from DB:", error);
    // Return zeros on error to avoid breaking metrics endpoint
    return {
      totalSuccess: 0,
      totalError: 0,
      totalRunning: 0,
      totalPending: 0,
      durationBuckets: new Array(WORKFLOW_DURATION_BUCKETS.length + 1).fill(0),
      durationSum: 0,
      durationCount: 0,
    };
  }
}

export type StepStats = {
  // Counts by step type and status
  countsByType: Record<string, { success: number; error: number }>;

  // Duration histogram data (count of steps in each bucket)
  durationBuckets: number[];
  durationSum: number;
  durationCount: number;
};

/**
 * Query step execution statistics from the database
 *
 * Returns counts and duration distribution for all completed steps.
 * This data is used to populate Prometheus metrics on each scrape.
 */
export async function getStepStatsFromDb(): Promise<StepStats> {
  try {
    // Query step counts by type and status
    const typeCounts = await db
      .select({
        nodeType: workflowExecutionLogs.nodeType,
        status: workflowExecutionLogs.status,
        count: count(),
      })
      .from(workflowExecutionLogs)
      .where(sql`${workflowExecutionLogs.status} IN ('success', 'error')`)
      .groupBy(workflowExecutionLogs.nodeType, workflowExecutionLogs.status);

    const stats: StepStats = {
      countsByType: {},
      durationBuckets: new Array(STEP_DURATION_BUCKETS.length + 1).fill(0),
      durationSum: 0,
      durationCount: 0,
    };

    for (const row of typeCounts) {
      if (!stats.countsByType[row.nodeType]) {
        stats.countsByType[row.nodeType] = { success: 0, error: 0 };
      }
      if (row.status === "success") {
        stats.countsByType[row.nodeType].success = row.count;
      } else if (row.status === "error") {
        stats.countsByType[row.nodeType].error = row.count;
      }
    }

    // Query duration histogram data for completed steps
    const durationQuery = await db
      .select({
        totalCount: count(),
        totalSum: sql<number>`COALESCE(SUM(CAST(${workflowExecutionLogs.duration} AS INTEGER)), 0)`,
        // Count steps in each bucket (cumulative)
        bucket0: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 50 THEN 1 ELSE 0 END)`,
        bucket1: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 100 THEN 1 ELSE 0 END)`,
        bucket2: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 250 THEN 1 ELSE 0 END)`,
        bucket3: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 500 THEN 1 ELSE 0 END)`,
        bucket4: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 1000 THEN 1 ELSE 0 END)`,
        bucket5: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 2000 THEN 1 ELSE 0 END)`,
        bucket6: sql<number>`SUM(CASE WHEN CAST(${workflowExecutionLogs.duration} AS INTEGER) <= 5000 THEN 1 ELSE 0 END)`,
      })
      .from(workflowExecutionLogs)
      .where(
        and(
          sql`${workflowExecutionLogs.status} IN ('success', 'error')`,
          sql`${workflowExecutionLogs.duration} IS NOT NULL`
        )
      );

    if (durationQuery[0]) {
      const row = durationQuery[0];
      stats.durationCount = Number(row.totalCount) || 0;
      stats.durationSum = Number(row.totalSum) || 0;
      stats.durationBuckets = [
        Number(row.bucket0) || 0,
        Number(row.bucket1) || 0,
        Number(row.bucket2) || 0,
        Number(row.bucket3) || 0,
        Number(row.bucket4) || 0,
        Number(row.bucket5) || 0,
        Number(row.bucket6) || 0,
        stats.durationCount, // +Inf bucket = total count
      ];
    }

    return stats;
  } catch (error) {
    console.error("[Metrics] Failed to query step stats from DB:", error);
    // Return zeros on error to avoid breaking metrics endpoint
    return {
      countsByType: {},
      durationBuckets: new Array(STEP_DURATION_BUCKETS.length + 1).fill(0),
      durationSum: 0,
      durationCount: 0,
    };
  }
}

/**
 * Query daily active users from the database
 *
 * Returns count of distinct users with active sessions in the last 24 hours.
 */
export async function getDailyActiveUsersFromDb(): Promise<number> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        count: countDistinct(sessions.userId),
      })
      .from(sessions)
      .where(
        and(
          gte(sessions.updatedAt, oneDayAgo),
          gte(sessions.expiresAt, new Date()) // Only count non-expired sessions
        )
      );

    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("[Metrics] Failed to query daily active users from DB:", error);
    return 0;
  }
}
