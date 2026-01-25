import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { workflowExecutions } from "@/lib/db/schema";

export async function POST(request: Request) {
  const auth = authenticateInternalService(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { workflowId, userId, input } = body;

  // Validate required fields
  if (!(workflowId && userId)) {
    return NextResponse.json(
      { error: "workflowId and userId are required" },
      { status: 400 }
    );
  }

  const [execution] = await db
    .insert(workflowExecutions)
    .values({
      workflowId,
      userId,
      status: "running",
      input: input || {},
    })
    .returning({ id: workflowExecutions.id });

  return NextResponse.json({ executionId: execution.id }, { status: 201 });
}
