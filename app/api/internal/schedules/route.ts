// start custom keeperhub code //
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { workflowSchedules, workflows } from "@/lib/db/schema";

export async function GET(request: Request) {
  const auth = authenticateInternalService(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const schedules = await db
    .select({
      id: workflowSchedules.id,
      workflowId: workflowSchedules.workflowId,
      cronExpression: workflowSchedules.cronExpression,
      timezone: workflowSchedules.timezone,
    })
    .from(workflowSchedules)
    .innerJoin(workflows, eq(workflowSchedules.workflowId, workflows.id))
    .where(
      and(eq(workflowSchedules.enabled, true), eq(workflows.enabled, true))
    );

  return NextResponse.json({ schedules });
}
// end keeperhub code //
