"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { create as createVercelProject } from "../vercel-project/create";
import type { SavedWorkflow, WorkflowData } from "./types";
import { getSession } from "./utils";

/**
 * Create a new workflow
 * Each workflow automatically gets its own dedicated project (1-to-1)
 */
export async function create(
  data: Omit<WorkflowData, "id">
): Promise<SavedWorkflow> {
  const session = await getSession();

  if (!(data.name && data.nodes && data.edges)) {
    throw new Error("Name, nodes, and edges are required");
  }

  // Generate "Untitled N" name if the provided name is "Untitled Workflow"
  let workflowName = data.name;
  if (data.name === "Untitled Workflow") {
    const userWorkflows = await db.query.workflows.findMany({
      where: eq(workflows.userId, session.user.id),
    });
    const count = userWorkflows.length + 1;
    workflowName = `Untitled ${count}`;
  }

  // Always create a dedicated project for this workflow (1-to-1 relationship)
  const project = await createVercelProject({
    name: workflowName,
  });

  const [newWorkflow] = await db
    .insert(workflows)
    .values({
      name: workflowName,
      description: data.description,
      nodes: data.nodes,
      edges: data.edges,
      userId: session.user.id,
      vercelProjectId: project.id,
    })
    .returning();

  return {
    ...newWorkflow,
    createdAt: newWorkflow.createdAt.toISOString(),
    updatedAt: newWorkflow.updatedAt.toISOString(),
    lastDeployedAt: newWorkflow.lastDeployedAt?.toISOString() || null,
  } as SavedWorkflow;
}
