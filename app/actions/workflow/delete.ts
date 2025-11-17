"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, workflows } from "@/lib/db/schema";
import { getSession, verifyWorkflowOwnership } from "./utils";

/**
 * Delete a workflow
 * Since workflows are 1-to-1 with projects, deleting the workflow also deletes the associated project
 */
export async function deleteWorkflow(id: string): Promise<void> {
  const session = await getSession();
  await verifyWorkflowOwnership(id, session.user.id);

  // Get the workflow to find its associated project
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, id),
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Delete the workflow first
  await db.delete(workflows).where(eq(workflows.id, id));

  // Delete the associated project (1-to-1 relationship)
  if (workflow.vercelProjectId) {
    await db.delete(projects).where(eq(projects.id, workflow.vercelProjectId));
  }
}
