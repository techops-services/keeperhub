// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, organization } from "@/lib/db/schema";
import type { CostBreakdown } from "./cost-calculator";

export type TransactionStatus = "pending" | "completed" | "refunded";

export type ReserveCreditParams = {
  organizationId: string;
  workflowId?: string | null;
  executionId: string; // Required for reservation tracking
  amount: number;
  breakdown?: CostBreakdown;
  note?: string;
};

export type ReserveCreditResult =
  | {
      success: true;
      transactionId: string;
      creditsReserved: number;
      previousBalance: number;
      newBalance: number;
    }
  | {
      success: false;
      error: string;
      currentBalance?: number;
      required?: number;
    };

export type FinalizeReservationResult =
  | {
      success: true;
      transactionId: string;
    }
  | {
      success: false;
      error: string;
    };

export type ReleaseReservationResult =
  | {
      success: true;
      creditsReturned: number;
      newBalance: number;
    }
  | {
      success: false;
      error: string;
    };

// Legacy types for backwards compatibility
export type DeductCreditParams = {
  organizationId: string;
  workflowId?: string | null;
  executionId?: string | null;
  amount?: number;
  breakdown?: CostBreakdown;
  note?: string;
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
 * Check if organization has sufficient credits
 */
export async function checkCreditBalance(
  organizationId: string,
  requiredCredits: number
): Promise<{
  sufficient: boolean;
  currentBalance: number;
  required: number;
}> {
  const [org] = await db
    .select({
      creditBalance: organization.creditBalance,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const currentBalance = org?.creditBalance ?? 0;

  return {
    sufficient: currentBalance >= requiredCredits,
    currentBalance,
    required: requiredCredits,
  };
}

/**
 * Format cost breakdown as transaction note
 */
function formatBreakdownNote(breakdown: CostBreakdown): string {
  const parts: string[] = [];

  if (breakdown.blocks > 0) {
    parts.push(`blocks: ${breakdown.blocks}`);
  }
  if (breakdown.functionCalls > 0) {
    parts.push(`functions: ${breakdown.functionCalls}`);
  }
  if (breakdown.gasCost > 0) {
    parts.push(`gas: ${breakdown.gasCost}`);
  }
  if (breakdown.platformFee > 0) {
    parts.push(`fee: ${breakdown.platformFee}`);
  }
  if (breakdown.gasStrategy) {
    parts.push(`strategy: ${breakdown.gasStrategy}`);
  }

  return parts.length > 0
    ? `Workflow execution (${parts.join(", ")})`
    : "Workflow execution";
}

/**
 * Reserve credits for a workflow execution.
 * Creates a "pending" transaction and deducts from balance.
 * Must be finalized or released after execution completes.
 *
 * @param params.organizationId - Organization to reserve from
 * @param params.executionId - Associated execution (required for tracking)
 * @param params.workflowId - Associated workflow (optional)
 * @param params.amount - Credits to reserve
 * @param params.breakdown - Cost breakdown for logging
 * @param params.note - Custom note
 */
export async function reserveCredits(
  params: ReserveCreditParams
): Promise<ReserveCreditResult> {
  const { organizationId, workflowId, executionId, amount, breakdown, note } =
    params;

  if (!organizationId) {
    return { success: false, error: "Missing organizationId" };
  }

  if (!executionId) {
    return { success: false, error: "Missing executionId for reservation" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
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
    if (currentBalance < amount) {
      return {
        success: false,
        error: "Insufficient credits",
        currentBalance,
        required: amount,
      };
    }

    // Reserve credits (deduct from balance)
    const newBalance = currentBalance - amount;

    // Update organization balance
    await db
      .update(organization)
      .set({ creditBalance: newBalance })
      .where(eq(organization.id, organizationId));

    // Generate transaction note
    const transactionNote =
      note ??
      (breakdown
        ? `[RESERVED] ${formatBreakdownNote(breakdown)}`
        : "[RESERVED] Workflow execution");

    // Record the transaction as pending
    const [transaction] = await db
      .insert(creditTransactions)
      .values({
        organizationId,
        type: "workflow_run",
        status: "pending",
        amount: -amount, // Negative for deduction
        balanceAfter: newBalance,
        workflowId: workflowId ?? null,
        executionId,
        note: transactionNote,
      })
      .returning({ id: creditTransactions.id });

    return {
      success: true,
      transactionId: transaction.id,
      creditsReserved: amount,
      previousBalance: currentBalance,
      newBalance,
    };
  } catch (error) {
    console.error("[CreditService] Error reserving credits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Finalize a credit reservation after successful execution.
 * Updates the transaction status from "pending" to "completed".
 *
 * @param executionId - The execution ID to finalize
 */
export async function finalizeReservation(
  executionId: string
): Promise<FinalizeReservationResult> {
  if (!executionId) {
    return { success: false, error: "Missing executionId" };
  }

  try {
    // Find the pending transaction for this execution
    const [transaction] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.executionId, executionId))
      .limit(1);

    if (!transaction) {
      return { success: false, error: "Transaction not found for execution" };
    }

    if (transaction.status === "completed") {
      // Already finalized, no action needed
      return { success: true, transactionId: transaction.id };
    }

    if (transaction.status === "refunded") {
      return { success: false, error: "Transaction already refunded" };
    }

    // Update status to completed
    await db
      .update(creditTransactions)
      .set({
        status: "completed",
        note:
          transaction.note?.replace("[RESERVED] ", "") ?? "Workflow execution",
        updatedAt: new Date(),
      })
      .where(eq(creditTransactions.id, transaction.id));

    return { success: true, transactionId: transaction.id };
  } catch (error) {
    console.error("[CreditService] Error finalizing reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Release a credit reservation after failed execution.
 * Returns the reserved credits to the organization's balance
 * and updates the transaction status to "refunded".
 *
 * @param executionId - The execution ID to release
 */
export async function releaseReservation(
  executionId: string
): Promise<ReleaseReservationResult> {
  if (!executionId) {
    return { success: false, error: "Missing executionId" };
  }

  try {
    // Find the pending transaction for this execution
    const [transaction] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.executionId, executionId))
      .limit(1);

    if (!transaction) {
      return { success: false, error: "Transaction not found for execution" };
    }

    if (transaction.status === "refunded") {
      // Already refunded, no action needed
      return {
        success: true,
        creditsReturned: 0,
        newBalance: transaction.balanceAfter,
      };
    }

    if (transaction.status === "completed") {
      return { success: false, error: "Cannot release completed transaction" };
    }

    // Get current organization balance
    const [org] = await db
      .select({
        creditBalance: organization.creditBalance,
      })
      .from(organization)
      .where(eq(organization.id, transaction.organizationId))
      .limit(1);

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    // Return credits (amount is negative, so we subtract to add back)
    const creditsToReturn = Math.abs(transaction.amount);
    const currentBalance = org.creditBalance ?? 0;
    const newBalance = currentBalance + creditsToReturn;

    // Update organization balance
    await db
      .update(organization)
      .set({ creditBalance: newBalance })
      .where(eq(organization.id, transaction.organizationId));

    // Update transaction status to refunded
    await db
      .update(creditTransactions)
      .set({
        status: "refunded",
        note: `[REFUNDED] ${transaction.note?.replace("[RESERVED] ", "") ?? "Workflow execution failed"}`,
        updatedAt: new Date(),
      })
      .where(eq(creditTransactions.id, transaction.id));

    return {
      success: true,
      creditsReturned: creditsToReturn,
      newBalance,
    };
  } catch (error) {
    console.error("[CreditService] Error releasing reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Legacy function - Deducts credits immediately (no reservation).
 * Use reserveCredits + finalizeReservation for new code.
 *
 * @deprecated Use reserveCredits + finalizeReservation instead
 */
export async function deductCredit(
  params: DeductCreditParams
): Promise<DeductCreditResult> {
  const {
    organizationId,
    workflowId,
    executionId,
    amount = 1,
    breakdown,
    note,
  } = params;

  if (!organizationId) {
    return { success: false, error: "Missing organizationId" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
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
    if (currentBalance < amount) {
      return {
        success: false,
        error: "Insufficient credits",
        currentBalance,
        required: amount,
      };
    }

    // Deduct credits
    const newBalance = currentBalance - amount;

    // Update organization balance
    await db
      .update(organization)
      .set({ creditBalance: newBalance })
      .where(eq(organization.id, organizationId));

    // Generate transaction note
    const transactionNote =
      note ??
      (breakdown ? formatBreakdownNote(breakdown) : "Workflow execution");

    // Record the transaction as completed
    await db.insert(creditTransactions).values({
      organizationId,
      type: "workflow_run",
      status: "completed",
      amount: -amount, // Negative for deduction
      balanceAfter: newBalance,
      workflowId: workflowId ?? null,
      executionId: executionId ?? null,
      note: transactionNote,
    });

    return {
      success: true,
      creditsDeducted: amount,
      previousBalance: currentBalance,
      newBalance,
    };
  } catch (error) {
    console.error("[CreditService] Error deducting credit:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get organization's current credit balance
 */
export async function getCreditBalance(
  organizationId: string
): Promise<number> {
  const [org] = await db
    .select({
      creditBalance: organization.creditBalance,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return org?.creditBalance ?? 0;
}
// end keeperhub code //
