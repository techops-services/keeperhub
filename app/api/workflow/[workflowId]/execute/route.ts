import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
// start custom keeperhub code //
import {
  getMetricsCollector,
  LabelKeys,
  MetricNames,
} from "@/keeperhub/lib/metrics";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateWorkflowIntegrations } from "@/lib/db/integrations";
import { workflowExecutions, workflows } from "@/lib/db/schema";
import { executeWorkflow } from "@/lib/workflow-executor.workflow";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

// biome-ignore lint/nursery/useMaxParams: Background execution requires all workflow context
async function executeWorkflowBackground(
  executionId: string,
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>
) {
  try {
    console.log("[Workflow Execute] Starting execution:", executionId);

    // SECURITY: We pass only the workflowId as a reference
    // Steps will fetch credentials internally using fetchWorkflowCredentials(workflowId)
    // This prevents credentials from being logged in Vercel's observability
    console.log("[Workflow Execute] Calling executeWorkflow with:", {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      hasExecutionId: !!executionId,
      workflowId,
    });

    // Use start() from workflow/api to properly execute the workflow
    start(executeWorkflow, [
      {
        nodes,
        edges,
        triggerInput: input,
        executionId,
        workflowId, // Pass workflow ID so steps can fetch credentials
      },
    ]);

    console.log("[Workflow Execute] Workflow started successfully");
  } catch (error) {
    console.error("[Workflow Execute] Error during execution:", error);
    console.error(
      "[Workflow Execute] Error stack:",
      error instanceof Error ? error.stack : "N/A"
    );

    // Update execution record with error
    await db
      .update(workflowExecutions)
      .set({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Workflow execution requires complex error handling and validation
export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;

    // Check for internal execution header (MVP auth for scheduled triggers)
    const isInternalExecution =
      request.headers.get("X-Internal-Execution") === "true";

    let userId: string;
    let workflow: typeof workflows.$inferSelect | undefined;

    if (isInternalExecution) {
      // Internal execution from scheduler - get userId from workflow
      console.log("[Workflow Execute] Internal execution request");

      workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, workflowId),
      });

      if (!workflow) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }

      userId = workflow.userId;
    } else {
      // Normal user execution - validate session
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get workflow and verify ownership
      workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, workflowId),
      });

      if (!workflow) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }

      // start custom keeperhub code //
      // Check access: owner or org member
      const isOwner = workflow.userId === session.user.id;
      const orgContext = await getOrgContext();
      const isSameOrg =
        !workflow.isAnonymous &&
        workflow.organizationId &&
        orgContext.organization?.id === workflow.organizationId;

      if (!(isOwner || isSameOrg)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // end keeperhub code //

      userId = session.user.id;
    }

    // start custom keeperhub code //
    // Validate that all integrationIds in workflow nodes belong to the user or org
    const validation = await validateWorkflowIntegrations(
      workflow.nodes as WorkflowNode[],
      userId,
      workflow.organizationId
    );
    // end keeperhub code //
    if (!validation.valid) {
      console.error(
        "[Workflow Execute] Invalid integration references:",
        validation.invalidIds
      );
      return NextResponse.json(
        { error: "Workflow contains invalid integration references" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const input = body.input || {};

    // Check if executionId was provided (for scheduled executions)
    // This allows the executor to pre-create the execution record
    let executionId = body.executionId;

    if (executionId) {
      // Verify execution exists and is in running state
      const existingExecution = await db.query.workflowExecutions.findFirst({
        where: eq(workflowExecutions.id, executionId),
      });

      if (existingExecution) {
        // Use existing execution
        console.log("[API] Using existing execution:", executionId);
      } else {
        // Create new execution with provided ID
        await db.insert(workflowExecutions).values({
          id: executionId,
          workflowId,
          userId,
          status: "running",
          input,
        });
        console.log("[API] Created execution with provided ID:", executionId);
      }
    } else {
      // Create new execution record
      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowId,
          userId,
          status: "running",
          input,
        })
        .returning();

      executionId = execution.id;
      console.log("[API] Created execution:", executionId);
    }

    // start custom keeperhub code //
    // Record workflow execution metric in API process (workflow runs in separate context)
    const triggerType = isInternalExecution ? "scheduled" : "manual";
    const metrics = getMetricsCollector();
    metrics.incrementCounter(MetricNames.WORKFLOW_EXECUTIONS_TOTAL, {
      [LabelKeys.TRIGGER_TYPE]: triggerType,
      [LabelKeys.WORKFLOW_ID]: workflowId,
    });
    // end keeperhub code //

    // Execute the workflow in the background (don't await)
    executeWorkflowBackground(
      executionId,
      workflowId,
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[],
      input
    );

    // Return immediately with the execution ID
    return NextResponse.json({
      executionId,
      status: "running",
    });
  } catch (error) {
    console.error("Failed to start workflow execution:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start workflow execution",
      },
      { status: 500 }
    );
  }
}
