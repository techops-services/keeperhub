import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { db } from "@/lib/db";
import { workflowPublicTags, workflows } from "@/lib/db/schema";

export async function PUT(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
): Promise<NextResponse> {
  try {
    const { workflowId } = await context.params;

    const orgContext = await getOrgContext();

    if (!orgContext.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const isOwner = workflow.userId === orgContext.user.id;
    const isSameOrg =
      !workflow.isAnonymous &&
      workflow.organizationId &&
      orgContext.organization?.id === workflow.organizationId;

    if (!(isOwner || isSameOrg)) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim();
    const publicTagIds: string[] = Array.isArray(body.publicTagIds)
      ? body.publicTagIds
      : [];

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (publicTagIds.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 tags allowed" },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(workflows)
        .set({
          name,
          visibility: "public",
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, workflowId));

      await tx
        .delete(workflowPublicTags)
        .where(eq(workflowPublicTags.workflowId, workflowId));

      if (publicTagIds.length > 0) {
        await tx.insert(workflowPublicTags).values(
          publicTagIds.map((tagId) => ({
            workflowId,
            publicTagId: tagId,
          }))
        );
      }
    });

    const updatedWorkflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!updatedWorkflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updatedWorkflow,
      createdAt: updatedWorkflow.createdAt.toISOString(),
      updatedAt: updatedWorkflow.updatedAt.toISOString(),
      isOwner: true,
    });
  } catch (error) {
    console.error("[GoLive] Failed to go live:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to go live",
      },
      { status: 500 }
    );
  }
}
