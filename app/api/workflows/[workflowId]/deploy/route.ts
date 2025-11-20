import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { deployWorkflowToVercel } from "@/lib/vercel-deployment";

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflow = await db.query.workflows.findFirst({
      where: and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, session.user.id)
      ),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Get app-level Vercel credentials
    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!vercelApiToken) {
      return NextResponse.json(
        { error: "Vercel API token not configured" },
        { status: 500 }
      );
    }

    // Check if workflow has Vercel project
    if (!workflow.vercelProjectId) {
      return NextResponse.json(
        { error: "This workflow is not linked to a Vercel project." },
        { status: 400 }
      );
    }

    // Update status to deploying
    await db
      .update(workflows)
      .set({ deploymentStatus: "deploying" })
      .where(eq(workflows.id, workflowId));

    // Deploy workflow
    const result = await deployWorkflowToVercel({
      workflows: [
        {
          id: workflow.id,
          name: workflow.name,
          nodes: workflow.nodes,
          edges: workflow.edges,
        },
      ],
      vercelToken: vercelApiToken,
      vercelTeamId,
      vercelProjectId: workflow.vercelProjectId,
    });

    // Update workflow with deployment result
    await db
      .update(workflows)
      .set({
        deploymentStatus: result.success ? "deployed" : "failed",
        deploymentUrl: result.deploymentUrl,
        lastDeployedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));

    return NextResponse.json({
      success: result.success,
      deploymentUrl: result.deploymentUrl,
      error: result.error,
      logs: result.logs,
    });
  } catch (error) {
    console.error("Failed to deploy workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to deploy workflow",
      },
      { status: 500 }
    );
  }
}
