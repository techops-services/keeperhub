import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, protocols, workflows } from "@/lib/db/schema";

// start custom KeeperHub code
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const isFeaturedRequest = searchParams.get("featured") === "true";

    const publicWorkflows = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        userId: workflows.userId,
        organizationId: workflows.organizationId,
        isAnonymous: workflows.isAnonymous,
        featured: workflows.featured,
        categoryId: workflows.categoryId,
        protocolId: workflows.protocolId,
        featuredOrder: workflows.featuredOrder,
        projectId: workflows.projectId,
        tagId: workflows.tagId,
        nodes: workflows.nodes,
        edges: workflows.edges,
        visibility: workflows.visibility,
        enabled: workflows.enabled,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
        categoryName: categories.name,
        protocolName: protocols.name,
      })
      .from(workflows)
      .leftJoin(categories, eq(workflows.categoryId, categories.id))
      .leftJoin(protocols, eq(workflows.protocolId, protocols.id))
      .where(
        and(
          eq(workflows.visibility, "public"),
          eq(workflows.featured, isFeaturedRequest)
        )
      )
      .orderBy(
        ...(isFeaturedRequest
          ? [desc(workflows.featuredOrder), desc(workflows.updatedAt)]
          : [desc(workflows.updatedAt)])
      );

    const mappedWorkflows = publicWorkflows.map((workflow) => ({
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    return NextResponse.json(mappedWorkflows);
  } catch (error) {
    console.error("Failed to get public workflows:", error);
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
