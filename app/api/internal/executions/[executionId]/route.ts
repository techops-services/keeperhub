import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { workflowExecutions } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ executionId: string }> }
) {
  const auth = authenticateInternalService(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const { executionId } = await context.params;
  const body = await request.json();
  const { status, error } = body;

  type ExecutionStatus = "running" | "success" | "error";
  const validStatuses: ExecutionStatus[] = ["running", "success", "error"];

  // Validate status
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "status must be 'running', 'success', or 'error'" },
      { status: 400 }
    );
  }

  const typedStatus = status as ExecutionStatus;

  // Check execution exists
  const existing = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, executionId),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  // Build update payload
  const updateData: {
    status: ExecutionStatus;
    error?: string | null;
    completedAt?: Date;
  } = { status: typedStatus };

  if (status === "error") {
    updateData.error = error || "Unknown error";
    updateData.completedAt = new Date();
  } else if (status === "success") {
    updateData.completedAt = new Date();
  }

  await db
    .update(workflowExecutions)
    .set(updateData)
    .where(eq(workflowExecutions.id, executionId));

  return NextResponse.json({ success: true });
}
