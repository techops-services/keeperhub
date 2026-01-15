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
  integrations,
  invitation,
  member,
  organization,
  sessions,
  users,
  workflowExecutionLogs,
  workflowExecutions,
  workflows,
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

// start custom keeperhub code //
export type UserStats = {
  total: number;
  verified: number;
  anonymous: number;
  withWorkflows: number;
  withIntegrations: number;
};

/**
 * Query user statistics from the database
 *
 * Returns counts of users by various categories.
 */
export async function getUserStatsFromDb(): Promise<UserStats> {
  try {
    const [
      totalResult,
      verifiedResult,
      anonymousResult,
      withWorkflowsResult,
      withIntegrationsResult,
    ] = await Promise.all([
      // Total users
      db.select({ count: count() }).from(users),
      // Verified users
      db
        .select({ count: count() })
        .from(users)
        .where(eq(users.emailVerified, true)),
      // Anonymous users
      db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isAnonymous, true)),
      // Users with at least one workflow
      db.select({ count: countDistinct(workflows.userId) }).from(workflows),
      // Users with at least one integration
      db
        .select({ count: countDistinct(integrations.userId) })
        .from(integrations),
    ]);

    return {
      total: Number(totalResult[0]?.count) || 0,
      verified: Number(verifiedResult[0]?.count) || 0,
      anonymous: Number(anonymousResult[0]?.count) || 0,
      withWorkflows: Number(withWorkflowsResult[0]?.count) || 0,
      withIntegrations: Number(withIntegrationsResult[0]?.count) || 0,
    };
  } catch (error) {
    console.error("[Metrics] Failed to query user stats from DB:", error);
    return {
      total: 0,
      verified: 0,
      anonymous: 0,
      withWorkflows: 0,
      withIntegrations: 0,
    };
  }
}

export type OrgStats = {
  total: number;
  membersTotal: number;
  membersByRole: Record<string, number>;
  invitationsPending: number;
  withWorkflows: number;
};

/**
 * Query organization statistics from the database
 *
 * Returns counts of organizations and their members.
 */
export async function getOrgStatsFromDb(): Promise<OrgStats> {
  try {
    const [
      totalResult,
      membersTotalResult,
      membersByRoleResult,
      invitationsPendingResult,
      withWorkflowsResult,
    ] = await Promise.all([
      // Total organizations
      db.select({ count: count() }).from(organization),
      // Total members across all orgs
      db.select({ count: count() }).from(member),
      // Members grouped by role
      db
        .select({
          role: member.role,
          count: count(),
        })
        .from(member)
        .groupBy(member.role),
      // Pending invitations
      db
        .select({ count: count() })
        .from(invitation)
        .where(eq(invitation.status, "pending")),
      // Organizations with at least one workflow
      db
        .select({ count: countDistinct(workflows.organizationId) })
        .from(workflows)
        .where(sql`${workflows.organizationId} IS NOT NULL`),
    ]);

    const membersByRole: Record<string, number> = {};
    for (const row of membersByRoleResult) {
      membersByRole[row.role] = row.count;
    }

    return {
      total: Number(totalResult[0]?.count) || 0,
      membersTotal: Number(membersTotalResult[0]?.count) || 0,
      membersByRole,
      invitationsPending: Number(invitationsPendingResult[0]?.count) || 0,
      withWorkflows: Number(withWorkflowsResult[0]?.count) || 0,
    };
  } catch (error) {
    console.error("[Metrics] Failed to query org stats from DB:", error);
    return {
      total: 0,
      membersTotal: 0,
      membersByRole: {},
      invitationsPending: 0,
      withWorkflows: 0,
    };
  }
}
// end keeperhub code //
