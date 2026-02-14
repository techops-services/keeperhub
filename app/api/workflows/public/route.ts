import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ErrorCategory, logSystemError } from "@/keeperhub/lib/logging";
import { db } from "@/lib/db";
import { publicTags, workflowPublicTags, workflows } from "@/lib/db/schema";

// start custom KeeperHub code

type TagInfo = { id: string; name: string; slug: string };

async function resolveTagFilter(tagSlug: string): Promise<string[] | "empty"> {
  const tag = await db.query.publicTags.findFirst({
    where: eq(publicTags.slug, tagSlug),
  });

  if (!tag) {
    return "empty";
  }

  const taggedRows = await db
    .select({ workflowId: workflowPublicTags.workflowId })
    .from(workflowPublicTags)
    .where(eq(workflowPublicTags.publicTagId, tag.id));

  const ids = taggedRows.map((r) => r.workflowId);
  return ids.length === 0 ? "empty" : ids;
}

async function fetchTagsByWorkflow(
  workflowIds: string[]
): Promise<Record<string, TagInfo[]>> {
  if (workflowIds.length === 0) {
    return {};
  }

  const tagJoins = await db
    .select({
      workflowId: workflowPublicTags.workflowId,
      tagId: publicTags.id,
      tagName: publicTags.name,
      tagSlug: publicTags.slug,
    })
    .from(workflowPublicTags)
    .innerJoin(publicTags, eq(publicTags.id, workflowPublicTags.publicTagId))
    .where(inArray(workflowPublicTags.workflowId, workflowIds));

  const result: Record<string, TagInfo[]> = {};
  for (const row of tagJoins) {
    if (!result[row.workflowId]) {
      result[row.workflowId] = [];
    }
    result[row.workflowId].push({
      id: row.tagId,
      name: row.tagName,
      slug: row.tagSlug,
    });
  }
  return result;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const isFeaturedRequest = searchParams.get("featured") === "true";
    const tagSlug = searchParams.get("tag");

    let workflowIdFilter: string[] | null = null;

    if (tagSlug) {
      const result = await resolveTagFilter(tagSlug);
      if (result === "empty") {
        return NextResponse.json([]);
      }
      workflowIdFilter = result;
    }

    const conditions = [
      eq(workflows.visibility, "public"),
      eq(workflows.featured, isFeaturedRequest),
    ];

    if (workflowIdFilter) {
      conditions.push(inArray(workflows.id, workflowIdFilter));
    }

    const publicWorkflows = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        userId: workflows.userId,
        organizationId: workflows.organizationId,
        isAnonymous: workflows.isAnonymous,
        featured: workflows.featured,
        featuredOrder: workflows.featuredOrder,
        projectId: workflows.projectId,
        tagId: workflows.tagId,
        nodes: workflows.nodes,
        edges: workflows.edges,
        visibility: workflows.visibility,
        enabled: workflows.enabled,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(and(...conditions))
      .orderBy(
        ...(isFeaturedRequest
          ? [desc(workflows.featuredOrder), desc(workflows.updatedAt)]
          : [desc(workflows.updatedAt)])
      );

    const tagsByWorkflow = await fetchTagsByWorkflow(
      publicWorkflows.map((w) => w.id)
    );

    const mappedWorkflows = publicWorkflows.map((workflow) => ({
      ...workflow,
      publicTags: tagsByWorkflow[workflow.id] ?? [],
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    return NextResponse.json(mappedWorkflows);
  } catch (error) {
    logSystemError(
      ErrorCategory.DATABASE,
      "Failed to get public workflows",
      error,
      {
        endpoint: "/api/workflows/public",
        operation: "get",
      }
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get public workflows",
      },
      { status: 500 }
    );
  }
}
// end custom KeeperHub code
