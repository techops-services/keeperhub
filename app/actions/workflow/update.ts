"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, workflows } from "@/lib/db/schema";
import type { SavedWorkflow, WorkflowData } from "./types";
import { getSession, verifyWorkflowOwnership } from "./utils";

/**
 * Update a workflow
 * Since workflows are 1-to-1 with projects, updating the workflow name also updates the project name
 */
export async function update(
  id: string,
  data: Partial<WorkflowData>
): Promise<SavedWorkflow> {
  const session = await getSession();
  await verifyWorkflowOwnership(id, session.user.id);

  // Build update data
  const updateData: {
    updatedAt: Date;
    name?: string;
    description?: string | null;
    nodes?: WorkflowData["nodes"];
    edges?: WorkflowData["edges"];
  } = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.nodes !== undefined) {
    updateData.nodes = data.nodes;
  }
  if (data.edges !== undefined) {
    updateData.edges = data.edges;
  }

  const [updatedWorkflow] = await db
    .update(workflows)
    .set(updateData)
    .where(eq(workflows.id, id))
    .returning();

  if (!updatedWorkflow) {
    throw new Error("Workflow not found");
  }

  // If name was updated, also update the associated project name (1-to-1 relationship)
  if (data.name !== undefined && updatedWorkflow.vercelProjectId) {
    await db
      .update(projects)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(projects.id, updatedWorkflow.vercelProjectId));
  }

  return {
    ...updatedWorkflow,
    createdAt: updatedWorkflow.createdAt.toISOString(),
    updatedAt: updatedWorkflow.updatedAt.toISOString(),
    lastDeployedAt: updatedWorkflow.lastDeployedAt?.toISOString() || null,
  } as SavedWorkflow;
}
