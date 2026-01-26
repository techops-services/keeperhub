import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTransactions, organization } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
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

    if (!organizationId) {
      return Response.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // Get organization with current balance
    const [org] = await db
      .select({
        creditBalance: organization.creditBalance,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!org) {
      return Response.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const currentBalance = org.creditBalance ?? 0;

    // Check if organization has sufficient credits
    if (currentBalance < 1) {
      return Response.json(
        {
          error: "Insufficient credits",
          currentBalance,
          required: 1,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Deduct 1 credit
    const newBalance = currentBalance - 1;

    // Update organization balance
    await db
      .update(organization)
      .set({ creditBalance: newBalance })
      .where(eq(organization.id, organizationId));

    // Record the transaction
    await db.insert(creditTransactions).values({
      organizationId,
      type: "workflow_run",
      amount: -1, // Negative for deduction
      balanceAfter: newBalance,
      workflowId: workflowId || null,
      executionId: executionId || null,
      note: "Workflow execution",
    });

    return Response.json({
      success: true,
      creditsDeducted: 1,
      previousBalance: currentBalance,
      newBalance,
    });
  } catch (error) {
    console.error("Error deducting credit:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
