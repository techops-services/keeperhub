import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowExecutions, workflows } from "@/lib/db/schema";
import { getEnvironmentVariables } from "@/lib/integrations/vercel";
import { getCredentials } from "@/lib/steps/credentials";
import { executeWorkflow } from "@/lib/workflow-executor.workflow";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Credential loading requires nested conditionals
async function loadCredentials(
  vercelProjectId: string | null
): Promise<Record<string, string>> {
  let credentials: Record<string, string> = {};

  if (vercelProjectId) {
    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (vercelApiToken) {
      const envResult = await getEnvironmentVariables({
        projectId: vercelProjectId,
        apiToken: vercelApiToken,
        teamId: vercelTeamId || undefined,
        decrypt: true,
      });

      if (envResult.status === "success" && envResult.envs) {
        const envMap = new Map(
          envResult.envs.map((env) => [env.key, env.value])
        );
        credentials = {
          RESEND_API_KEY: envMap.get("RESEND_API_KEY") || "",
          RESEND_FROM_EMAIL: envMap.get("RESEND_FROM_EMAIL") || "",
          LINEAR_API_KEY: envMap.get("LINEAR_API_KEY") || "",
          LINEAR_TEAM_ID: envMap.get("LINEAR_TEAM_ID") || "",
          SLACK_API_KEY: envMap.get("SLACK_API_KEY") || "",
          AI_GATEWAY_API_KEY: envMap.get("AI_GATEWAY_API_KEY") || "",
          OPENAI_API_KEY: envMap.get("OPENAI_API_KEY") || "",
          DATABASE_URL: envMap.get("DATABASE_URL") || "",
        };
      }
    }
  }

  // Fall back to system credentials if no project credentials
  if (Object.keys(credentials).length === 0) {
    const systemCreds = getCredentials("system");
    credentials = {
      RESEND_API_KEY: systemCreds.RESEND_API_KEY || "",
      RESEND_FROM_EMAIL: systemCreds.RESEND_FROM_EMAIL || "",
      LINEAR_API_KEY: systemCreds.LINEAR_API_KEY || "",
      LINEAR_TEAM_ID: systemCreds.LINEAR_TEAM_ID || "",
      SLACK_API_KEY: systemCreds.SLACK_API_KEY || "",
      AI_GATEWAY_API_KEY: systemCreds.AI_GATEWAY_API_KEY || "",
      OPENAI_API_KEY: systemCreds.OPENAI_API_KEY || "",
      DATABASE_URL: systemCreds.DATABASE_URL || "",
    };
  }

  return credentials;
}

// biome-ignore lint/nursery/useMaxParams: Background execution requires all workflow context
async function executeWorkflowBackground(
  executionId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>,
  vercelProjectId: string | null
) {
  try {
    console.log("[Workflow Execute] Starting execution:", executionId);

    // Load credentials
    console.log("[Workflow Execute] Loading credentials...");
    const credentials = await loadCredentials(vercelProjectId);
    console.log(
      "[Workflow Execute] Credentials loaded:",
      Object.keys(credentials)
    );

    // Execute using workflow-based executor
    console.log("[Workflow Execute] Calling executeWorkflow with:", {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      hasExecutionId: !!executionId,
    });

    // Use start() from workflow/api to properly execute the workflow
    // This runs asynchronously - the workflow will update the execution status when complete
    start(executeWorkflow, [
      {
        nodes,
        edges,
        triggerInput: input,
        credentials,
        executionId,
      },
    ]);

    console.log("[Workflow Execute] Workflow started successfully");

    // Note: The workflow is running asynchronously
    // The execution record will be updated by the workflow when it completes
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

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;

    // Get session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get workflow and verify ownership
    const workflow = await db.query.workflows.findFirst({
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

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const input = body.input || {};

    // Create execution record
    const [execution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId,
        userId: session.user.id,
        status: "running",
        input,
      })
      .returning();

    console.log("[API] Created execution:", execution.id);

    // Execute the workflow in the background (don't await)
    executeWorkflowBackground(
      execution.id,
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[],
      input,
      workflow.vercelProjectId
    );

    // Return immediately with the execution ID
    return NextResponse.json({
      executionId: execution.id,
      status: "running",
    });
  } catch (error) {
    console.error("Failed to start workflow execution:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to execute workflow",
      },
      { status: 500 }
    );
  }
}
