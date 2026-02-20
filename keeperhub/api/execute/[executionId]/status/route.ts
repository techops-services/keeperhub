import "server-only";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directExecutions } from "@/lib/db/schema";
import { validateApiKey } from "../../_lib/auth";
import { checkRateLimit } from "../../_lib/rate-limit";
import type { ExecutionStatusResponse } from "../../_lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
): Promise<NextResponse> {
  const apiKeyCtx = await validateApiKey(request);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(apiKeyCtx.apiKeyId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const { executionId } = await params;

  const executions = await db
    .select()
    .from(directExecutions)
    .where(
      and(
        eq(directExecutions.id, executionId),
        eq(directExecutions.organizationId, apiKeyCtx.organizationId)
      )
    )
    .limit(1);

  const execution = executions[0];

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  const output = execution.output as Record<string, unknown> | null;

  const response: ExecutionStatusResponse = {
    executionId: execution.id,
    status: execution.status as ExecutionStatusResponse["status"],
    type: execution.type as ExecutionStatusResponse["type"],
    transactionHash: execution.transactionHash,
    transactionLink: (output?.transactionLink as string) ?? null,
    result: output ?? null,
    error: execution.error,
    createdAt: execution.createdAt.toISOString(),
    completedAt: execution.completedAt?.toISOString() ?? null,
  };

  return NextResponse.json(response);
}
