// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export async function GET(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  const auth = authenticateInternalService(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const { workflowId } = await context.params;

  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
    columns: {
      id: true,
      enabled: true,
      userId: true,
      nodes: true,
      edges: true,
    },
  });

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}
// end keeperhub code //
