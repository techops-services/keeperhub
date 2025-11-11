"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, workflows } from "@/lib/db/schema";

/**
 * Get workflow count for a project
 */
export async function getProjectWorkflowCount(
  projectId: string
): Promise<number> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const projectWorkflows = await db.query.workflows.findMany({
    where: and(
      eq(workflows.vercelProjectId, projectId),
      eq(workflows.userId, session.user.id)
    ),
  });

  return projectWorkflows.length;
}

/**
 * Delete a project and all associated workflows
 */
export async function deleteVercelProject(id: string): Promise<void> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Delete all workflows associated with this project first
  await db
    .delete(workflows)
    .where(
      and(
        eq(workflows.vercelProjectId, id),
        eq(workflows.userId, session.user.id)
      )
    );

  // Then delete the project
  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)));
}
