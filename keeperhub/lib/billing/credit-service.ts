// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, organization } from "@/lib/db/schema";

export type DeductCreditParams = {
  organizationId: string;
  workflowId?: string | null;
  executionId?: string | null;
};

export type DeductCreditResult =
  | {
      success: true;
      creditsDeducted: number;
      previousBalance: number;
      newBalance: number;
    }
  | {
      success: false;
      error: string;
      currentBalance?: number;
      required?: number;
    };

/**
 * Deducts 1 credit from an organization's balance.
 * Can be called directly from server-side code without HTTP overhead.
 */
export async function deductCredit(
  params: DeductCreditParams
): Promise<DeductCreditResult> {
  const { organizationId, workflowId, executionId } = params;

  if (!organizationId) {
    return { success: false, error: "Missing organizationId" };
  }

  try {
    // Get organization with current balance
    const [org] = await db
      .select({
        creditBalance: organization.creditBalance,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    const currentBalance = org.creditBalance ?? 0;

    // Check if organization has sufficient credits
    if (currentBalance < 1) {
      return {
        success: false,
        error: "Insufficient credits",
        currentBalance,
        required: 1,
      };
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
      workflowId: workflowId ?? null,
      executionId: executionId ?? null,
      note: "Workflow execution",
    });

    return {
      success: true,
      creditsDeducted: 1,
      previousBalance: currentBalance,
      newBalance,
    };
  } catch (error) {
    console.error("Error deducting credit:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
// end keeperhub code //
