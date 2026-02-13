import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

type FeaturedFields = {
  featured?: boolean;
  category?: string | null;
  protocol?: string | null;
  featuredOrder?: number | null;
};

const ALLOWED_FEATURED_FIELDS: (keyof FeaturedFields)[] = [
  "featured",
  "category",
  "protocol",
  "featuredOrder",
];

export async function POST(request: Request) {
  try {
    const auth = authenticateInternalService(request);
    if (!auth.authenticated || auth.service !== "hub") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId, ...fields } = body;

    if (!workflowId || typeof workflowId !== "string") {
      return NextResponse.json(
        { error: "workflowId is required" },
        { status: 400 }
      );
    }

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const updateData: FeaturedFields = {};

    if (fields.featured === undefined) {
      updateData.featured = true;
    }

    for (const field of ALLOWED_FEATURED_FIELDS) {
      if (field in fields) {
        updateData[field] = fields[field];
      }
    }

    const [updated] = await db
      .update(workflows)
      .set(updateData)
      .where(eq(workflows.id, workflowId))
      .returning({
        id: workflows.id,
        name: workflows.name,
        featured: workflows.featured,
        category: workflows.category,
        protocol: workflows.protocol,
        featuredOrder: workflows.featuredOrder,
      });

    return NextResponse.json({
      success: true,
      workflow: updated,
    });
  } catch (error) {
    console.error("[Hub Featured] Error:", error);
    return NextResponse.json(
      { error: "Failed to update featured workflow" },
      { status: 500 }
    );
  }
}
