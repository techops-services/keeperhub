import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflowExecutions, workflows } from "@/lib/db/schema";

/**
 * Get organizationId from executionId
 *
 * Workflow executions are scoped to organizations, not individual users.
 * This helper joins workflow_executions → workflows to get the organizationId.
 *
 * @param executionId - Execution ID (passed via _context in workflow steps)
 * @returns organizationId - Organization that owns the workflow
 * @throws Error if execution not found or workflow has no organization
 */
export async function getOrganizationIdFromExecution(
  executionId: string | undefined
): Promise<string> {
  if (!executionId) {
    throw new Error("Execution ID is required to get organization ID");
  }

  // Join workflow_executions with workflows to get organizationId
  const result = await db
    .select({
      organizationId: workflows.organizationId,
      workflowId: workflowExecutions.workflowId,
    })
    .from(workflowExecutions)
    .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  const { organizationId } = result[0];

  if (!organizationId) {
    throw new Error(
      "Workflow has no organization. This workflow may be from an anonymous user or migration is incomplete."
    );
  }

  return organizationId;
}

/**
 * @deprecated Use getOrganizationIdFromExecution instead
 * Get userId from executionId (legacy pattern - kept for backwards compatibility)
 */
export async function getUserIdFromExecution(
  executionId: string | undefined
): Promise<string> {
  if (!executionId) {
    throw new Error("Execution ID is required to get user ID");
  }

  const execution = await db
    .select({ userId: workflowExecutions.userId })
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  if (execution.length === 0) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  return execution[0].userId;
}
