import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { createWorkflowJob } from "@/keeperhub/lib/k8s-job-creator";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateWorkflowIntegrations } from "@/lib/db/integrations";
import { workflowExecutions, workflows } from "@/lib/db/schema";
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
  // start custom keeperhub code //
    console.log(
      "[Workflow Execute] Creating K8s Job for execution:",
      executionId
    );

    // Create K8s Job to execute the workflow
    // This replaces the Vercel workflow/api start() call which doesn't work in self-hosted K8s
    const job = await createWorkflowJob({
      workflowId,
      executionId,
      input,
      // No scheduleId for manual executions
    });

    console.log(
      "[Workflow Execute] K8s Job created successfully:",
      job.metadata?.name
    );
  } catch (error) {
    console.error("[Workflow Execute] Error creating K8s Job:", error);
    console.error(
      "[Workflow Execute] Error stack:",
      error instanceof Error ? error.stack : "N/A"
    );
  // end keeperhub code //

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

      if (workflow.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      userId = session.user.id;
    }

    // Validate that all integrationIds in workflow nodes belong to the workflow owner
    const validation = await validateWorkflowIntegrations(
      workflow.nodes as WorkflowNode[],
      userId
    );
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
    // Execute the workflow in the background (don't await)
    // This creates a K8s Job instead of using Vercel's workflow/api start()
    executeWorkflowBackground(
      executionId,
      workflowId,
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[],
      input
    );
    // end keeperhub code //

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
