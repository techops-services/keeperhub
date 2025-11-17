"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";
import { create as createVercelProject } from "../vercel-project/create";
import { CURRENT_WORKFLOW_NAME } from "./constants";
import type { WorkflowData } from "./types";
import { getSession } from "./utils";

/**
 * Save the current workflow state
 */
export async function saveCurrent(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<WorkflowData> {
  const session = await getSession();

  if (!(nodes && edges)) {
    throw new Error("Nodes and edges are required");
  }

  // Check if current workflow exists
  const [existingWorkflow] = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.name, CURRENT_WORKFLOW_NAME),
        eq(workflows.userId, session.user.id)
      )
    )
    .limit(1);

  let savedWorkflow: typeof existingWorkflow;

  if (existingWorkflow) {
    // Update existing current workflow
    [savedWorkflow] = await db
      .update(workflows)
      .set({
        nodes,
        edges,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, existingWorkflow.id))
      .returning();
  } else {
    // Create new current workflow with a dedicated project
    const project = await createVercelProject({
      name: CURRENT_WORKFLOW_NAME,
    });

    [savedWorkflow] = await db
      .insert(workflows)
      .values({
        name: CURRENT_WORKFLOW_NAME,
        description: "Auto-saved current workflow",
        nodes,
        edges,
        userId: session.user.id,
        vercelProjectId: project.id,
      })
      .returning();
  }

  return {
    id: savedWorkflow.id,
    nodes: savedWorkflow.nodes as WorkflowNode[],
    edges: savedWorkflow.edges as WorkflowEdge[],
  };
}
