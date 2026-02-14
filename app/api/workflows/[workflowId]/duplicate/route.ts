import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { ErrorCategory, logSystemError } from "@/keeperhub/lib/logging";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
// start custom keeperhub code //
import { remapTemplateRefsInString } from "@/lib/utils/template";

// end custom keeperhub code //

// Node type for type-safe node manipulation
type WorkflowNodeLike = {
  id: string;
  data?: {
    config?: {
      integrationId?: string;
      [key: string]: unknown;
    };
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// start custom keeperhub code //
/** Recursively rewrite a single value (string, object, or array) using old->new node ID map */
function remapTemplateRefsInValue(
  value: unknown,
  idMap: Map<string, string>
): unknown {
  if (typeof value === "string") {
    return remapTemplateRefsInString(value, idMap);
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapTemplateRefsInValue(item, idMap));
  }
  if (typeof value === "object" && value !== null) {
    return remapTemplateRefsInConfig(value as Record<string, unknown>, idMap);
  }
  return value;
}

/** Recursively rewrite {{@nodeId:...}} template refs in config using old->new node ID map */
function remapTemplateRefsInConfig(
  config: Record<string, unknown> | undefined,
  idMap: Map<string, string>
): Record<string, unknown> | undefined {
  if (!config || typeof config !== "object") {
    return config;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    result[key] = remapTemplateRefsInValue(value, idMap);
  }
  return result;
}

/** Duplicate nodes with new IDs, strip integration IDs, and remap template refs in config */
function duplicateNodes(
  oldNodes: WorkflowNodeLike[],
  idMap: Map<string, string>
): WorkflowNodeLike[] {
  return oldNodes.map((node) => {
    const newId = idMap.get(node.id) ?? nanoid();
    const newNode: WorkflowNodeLike = { ...node, id: newId };
    if (newNode.data) {
      const data = { ...newNode.data };
      if (data.config) {
        const { integrationId: _, ...configWithoutIntegration } = data.config;
        data.config = remapTemplateRefsInConfig(
          configWithoutIntegration,
          idMap
        );
      }
      data.status = "idle";
      newNode.data = data;
    }
    return newNode;
  });
}
// end custom keeperhub code //

// Edge type for type-safe edge manipulation
type WorkflowEdgeLike = {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
};

// Helper to update edge references to new node IDs
function updateEdgeReferences(
  edges: WorkflowEdgeLike[],
  oldNodes: WorkflowNodeLike[],
  newNodes: WorkflowNodeLike[]
): WorkflowEdgeLike[] {
  // Create mapping from old node IDs to new node IDs
  const idMap = new Map<string, string>();
  oldNodes.forEach((oldNode, index) => {
    idMap.set(oldNode.id, newNodes[index].id);
  });

  return edges.map((edge) => ({
    ...edge,
    id: nanoid(),
    source: idMap.get(edge.source) || edge.source,
    target: idMap.get(edge.target) || edge.target,
  }));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sequential workflow duplication logic
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

    // Find the workflow to duplicate
    const sourceWorkflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!sourceWorkflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const isOwner = session.user.id === sourceWorkflow.userId;

    // If not owner, check if workflow is public
    if (!isOwner && sourceWorkflow.visibility !== "public") {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // start custom keeperhub code //
    // Get organization context for the new workflow
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id || null;
    const isAnonymous = orgContext.isAnonymous || !orgContext.organization;
    // end keeperhub code //

    // Generate new IDs for nodes
    const oldNodes = sourceWorkflow.nodes as WorkflowNodeLike[];
    // start custom keeperhub code //
    const idMap = new Map<string, string>();
    for (const n of oldNodes) {
      idMap.set(n.id, nanoid());
    }
    const newNodes = duplicateNodes(oldNodes, idMap);
    // end custom keeperhub code //
    const newEdges = updateEdgeReferences(
      sourceWorkflow.edges as WorkflowEdgeLike[],
      oldNodes,
      newNodes
    );

    // start custom keeperhub code //
    // Count workflows in current context (org or anonymous) to generate unique name
    const existingWorkflows = isAnonymous
      ? await db.query.workflows.findMany({
          where: and(
            eq(workflows.userId, session.user.id),
            eq(workflows.isAnonymous, true)
          ),
        })
      : await db.query.workflows.findMany({
          where: and(
            eq(workflows.organizationId, organizationId ?? ""),
            eq(workflows.isAnonymous, false)
          ),
        });
    // end keeperhub code //

    // Generate a unique name
    const baseName = `${sourceWorkflow.name} (Copy)`;
    let workflowName = baseName;
    const existingNames = new Set(existingWorkflows.map((w) => w.name));

    if (existingNames.has(workflowName)) {
      let counter = 2;
      while (existingNames.has(`${baseName} ${counter}`)) {
        counter += 1;
      }
      workflowName = `${baseName} ${counter}`;
    }

    // Create the duplicated workflow
    const newWorkflowId = generateId();
    const [newWorkflow] = await db
      .insert(workflows)
      .values({
        id: newWorkflowId,
        name: workflowName,
        description: sourceWorkflow.description,
        nodes: newNodes,
        edges: newEdges,
        userId: session.user.id,
        // start custom keeperhub code //
        organizationId,
        isAnonymous,
        // end keeperhub code //
        visibility: "private", // Duplicated workflows are always private
      })
      .returning();

    // start custom keeperhub code //
    // If moving an anonymous workflow to an org, delete the original
    // This prevents the old anonymous workflow from being accessible after sign out
    if (sourceWorkflow.isAnonymous && isOwner && !isAnonymous) {
      await db.delete(workflows).where(eq(workflows.id, workflowId));
    }
    // end keeperhub code //

    return NextResponse.json({
      ...newWorkflow,
      createdAt: newWorkflow.createdAt.toISOString(),
      updatedAt: newWorkflow.updatedAt.toISOString(),
      isOwner: true,
    });
  } catch (error) {
    logSystemError(
      ErrorCategory.DATABASE,
      "Failed to duplicate workflow",
      error,
      {
        endpoint: "/api/workflows/[workflowId]/duplicate",
        operation: "create",
      }
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to duplicate workflow",
      },
      { status: 500 }
    );
  }
}
