import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateWorkflowIntegrations } from "@/lib/db/integrations";
import { workflows } from "@/lib/db/schema";
import { syncWorkflowSchedule } from "@/lib/schedule-service";

// end keeperhub code //

// Helper to strip sensitive data from nodes for public viewing
function sanitizeNodesForPublicView(
  nodes: Record<string, unknown>[]
): Record<string, unknown>[] {
  return nodes.map((node) => {
    const sanitizedNode = { ...node };
    if (
      sanitizedNode.data &&
      typeof sanitizedNode.data === "object" &&
      sanitizedNode.data !== null
    ) {
      const data = { ...(sanitizedNode.data as Record<string, unknown>) };
      // Remove integrationId from config to not expose which integrations are used
      if (
        data.config &&
        typeof data.config === "object" &&
        data.config !== null
      ) {
        const { integrationId: _, ...configWithoutIntegration } =
          data.config as Record<string, unknown>;
        data.config = configWithoutIntegration;
      }
      sanitizedNode.data = data;
    }
    return sanitizedNode;
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // First, try to find the workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const isOwner = session?.user?.id === workflow.userId;

    // start custom keeperhub code //
    // Check organization membership for private workflows
    const orgContext = await getOrgContext();
    const isSameOrg =
      !workflow.isAnonymous &&
      workflow.organizationId &&
      orgContext.organization?.id === workflow.organizationId;

    // Access control:
    // - Public workflows: anyone can view (sanitized)
    // - Private workflows: owner or org member can view
    // - Anonymous workflows: only owner can view
    if (!isOwner && workflow.visibility !== "public" && !isSameOrg) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const hasFullAccess = isOwner || isSameOrg;
    // end keeperhub code //

    // For public workflows viewed by non-owners, sanitize sensitive data
    const responseData = {
      ...workflow,
      nodes: hasFullAccess
        ? workflow.nodes
        : sanitizeNodesForPublicView(
            workflow.nodes as Record<string, unknown>[]
          ),
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      isOwner,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Failed to get workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get workflow",
      },
      { status: 500 }
    );
  }
}

// Helper to build update data from request body
function buildUpdateData(
  body: Record<string, unknown>
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const fields = ["name", "description", "nodes", "edges", "visibility"];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  return updateData;
}

// Helper to validate visibility value
function isValidVisibility(visibility: unknown): boolean {
  return (
    visibility === undefined ||
    visibility === "private" ||
    visibility === "public"
  );
}

// Helper to validate workflow access for PATCH/DELETE operations
async function validateWorkflowAccess(
  workflowId: string,
  userId: string,
  orgContext: { organization?: { id: string } | null }
): Promise<{
  workflow: typeof workflows.$inferSelect | null;
  hasAccess: boolean;
}> {
  const existingWorkflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
  });

  if (!existingWorkflow) {
    return { workflow: null, hasAccess: false };
  }

  const isOwner = existingWorkflow.userId === userId;
  const isSameOrg =
    !existingWorkflow.isAnonymous &&
    existingWorkflow.organizationId &&
    orgContext.organization?.id === existingWorkflow.organizationId;

  return {
    workflow: existingWorkflow,
    hasAccess: isOwner || Boolean(isSameOrg),
  };
}

export async function PATCH(
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

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const { workflow: existingWorkflow, hasAccess } =
      await validateWorkflowAccess(workflowId, session.user.id, orgContext);

    if (!(existingWorkflow && hasAccess)) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    // end keeperhub code //

    const body = await request.json();

    // Validate that all integrationIds in nodes belong to the current user
    if (Array.isArray(body.nodes)) {
      const validation = await validateWorkflowIntegrations(
        body.nodes,
        session.user.id,
        // start custom keeperhub code //
        orgContext.organization?.id || null
        // end keeperhub code //
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Invalid integration references in workflow" },
          { status: 403 }
        );
      }
    }

    // Validate visibility value if provided
    if (!isValidVisibility(body.visibility)) {
      return NextResponse.json(
        { error: "Invalid visibility value. Must be 'private' or 'public'" },
        { status: 400 }
      );
    }

    const updateData = buildUpdateData(body);

    const [updatedWorkflow] = await db
      .update(workflows)
      .set(updateData)
      .where(eq(workflows.id, workflowId))
      .returning();

    if (!updatedWorkflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Sync schedule if nodes were updated
    if (body.nodes !== undefined) {
      const syncResult = await syncWorkflowSchedule(workflowId, body.nodes);
      if (!syncResult.synced) {
        console.warn(
          `[Workflow] Schedule sync failed for ${workflowId}:`,
          syncResult.error
        );
        // Don't fail the request, but log the warning
      }
    }

    return NextResponse.json({
      ...updatedWorkflow,
      createdAt: updatedWorkflow.createdAt.toISOString(),
      updatedAt: updatedWorkflow.updatedAt.toISOString(),
      isOwner: true,
    });
  } catch (error) {
    console.error("Failed to update workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update workflow",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const { hasAccess } = await validateWorkflowAccess(
      workflowId,
      session.user.id,
      orgContext
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    // end keeperhub code //

    await db.delete(workflows).where(eq(workflows.id, workflowId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete workflow",
      },
      { status: 500 }
    );
  }
}
