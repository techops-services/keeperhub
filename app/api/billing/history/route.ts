import { and, desc, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTransactions, member, workflows } from "@/lib/db/schema";

export async function GET(req: Request): Promise<Response> {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get orgId from query params
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    if (!orgId) {
      return Response.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Verify user has access to organization
    const membership = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return Response.json(
        { error: "You don't have access to this organization" },
        { status: 403 }
      );
    }

    // start custom keeperhub code //
    // Fetch transaction history excluding refunded transactions
    // LEFT JOIN workflows to get workflow names for display
    const transactions = await db
      .select({
        id: creditTransactions.id,
        type: creditTransactions.type,
        amount: creditTransactions.amount,
        balanceAfter: creditTransactions.balanceAfter,
        txHash: creditTransactions.txHash,
        paymentToken: creditTransactions.paymentToken,
        paymentAmount: creditTransactions.paymentAmount,
        usdValue: creditTransactions.usdValue,
        workflowId: creditTransactions.workflowId,
        executionId: creditTransactions.executionId,
        note: creditTransactions.note,
        createdAt: creditTransactions.createdAt,
        workflowName: workflows.name,
      })
      .from(creditTransactions)
      .leftJoin(workflows, eq(creditTransactions.workflowId, workflows.id))
      .where(
        and(
          eq(creditTransactions.organizationId, orgId),
          ne(creditTransactions.status, "refunded")
        )
      )
      .orderBy(desc(creditTransactions.createdAt));
    // end keeperhub code //

    return Response.json({ transactions });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
