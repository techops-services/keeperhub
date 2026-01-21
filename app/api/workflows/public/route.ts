import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

// start custom KeeperHub code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isFeaturedRequest = searchParams.get("featured") === "true";

    const publicWorkflows = await db
      .select()
      .from(workflows)
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
