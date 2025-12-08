import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export async function GET(request: Request) {
  console.log("[Workflows API] GET request received");
  try {
    console.log("[Workflows API] Attempting to get session...");
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    console.log("[Workflows API] Session result:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
    });

    if (!session?.user) {
      console.log("[Workflows API] No user session, returning empty array");
      return NextResponse.json([], { status: 200 });
    }

    console.log(
      "[Workflows API] Querying workflows for user:",
      session.user.id
    );
    const userWorkflows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, session.user.id))
      .orderBy(desc(workflows.updatedAt));

    console.log("[Workflows API] Found workflows:", userWorkflows.length);

    const mappedWorkflows = userWorkflows.map((workflow) => ({
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    console.log("[Workflows API] Returning workflows successfully");
    return NextResponse.json(mappedWorkflows);
  } catch (error) {
    console.error("[Workflows API] Error occurred:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get workflows",
      },
      { status: 500 }
    );
  }
}
