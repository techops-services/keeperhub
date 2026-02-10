import { headers } from "next/headers";
import { deductCredit } from "@/keeperhub/lib/billing/credit-service";
import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  // Check for internal service authentication (allows workflow execution to deduct)
  const internalAuth = authenticateInternalService(req);
  const isInternalExecution = internalAuth.authenticated;

  if (!isInternalExecution) {
    // For non-internal requests, authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Parse request body
  const body = await req.json();
  const { organizationId, workflowId, executionId } = body;

  const result = await deductCredit({
    organizationId,
    workflowId,
    executionId,
  });

  if (!result.success) {
    const status = result.error === "Insufficient credits" ? 402 : 400;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
