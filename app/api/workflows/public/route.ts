import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

// start custom KeeperHub code
export async function GET() {
  try {
    const publicWorkflows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.visibility, "public"))
      .orderBy(desc(workflows.updatedAt));

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
