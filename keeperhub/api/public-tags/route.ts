import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicTags, workflowPublicTags } from "@/lib/db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(): Promise<NextResponse> {
  try {
    const allTags = await db
      .select({
        id: publicTags.id,
        name: publicTags.name,
        slug: publicTags.slug,
        createdAt: publicTags.createdAt,
        workflowCount: count(workflowPublicTags.workflowId),
      })
      .from(publicTags)
      .leftJoin(
        workflowPublicTags,
        eq(workflowPublicTags.publicTagId, publicTags.id)
      )
      .groupBy(publicTags.id)
      .orderBy(publicTags.name);

    const response = allTags.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[PublicTags] Failed to list public tags:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list public tags",
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

    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = slugify(name);

    if (!slug) {
      return NextResponse.json({ error: "Invalid tag name" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(publicTags)
      .where(eq(publicTags.slug, slug))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        ...existing,
        workflowCount: 0,
        createdAt: existing.createdAt.toISOString(),
      });
    }

    const [newTag] = await db
      .insert(publicTags)
      .values({ name, slug })
      .returning();

    return NextResponse.json(
      {
        ...newTag,
        workflowCount: 0,
        createdAt: newTag.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PublicTags] Failed to create public tag:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create public tag",
      },
      { status: 500 }
    );
  }
}
