import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/keeperhub/lib/api-key-auth";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, workflows } from "@/lib/db/schema";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const apiKeyAuth = await authenticateApiKey(request);
    let organizationId: string | null;

    if (apiKeyAuth.authenticated) {
      organizationId = apiKeyAuth.organizationId || null;
    } else {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const context = await getOrgContext();
      organizationId = context.organization?.id || null;
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const orgCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        organizationId: categories.organizationId,
        userId: categories.userId,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        workflowCount: count(workflows.id),
      })
      .from(categories)
      .leftJoin(workflows, eq(workflows.categoryId, categories.id))
      .where(eq(categories.organizationId, organizationId))
      .groupBy(categories.id)
      .orderBy(categories.name);

    const response = orgCategories.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Categories] Failed to list categories:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list categories",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getOrgContext();
    const organizationId = context.organization?.id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name,
        organizationId,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json(
      {
        ...newCategory,
        workflowCount: 0,
        createdAt: newCategory.createdAt.toISOString(),
        updatedAt: newCategory.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Categories] Failed to create category:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create category",
      },
      { status: 500 }
    );
  }
}
