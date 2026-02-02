import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, organization } from "@/lib/db/schema";
import { hashOrgId } from "./contracts";

const NEW_ORG_BONUS = 2500;

/**
 * Grant 2,500 free credits to a new organization
 * Should be called when organization creates a Para wallet
 */
export async function grantNewOrgBonus(
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // Check if org already has credits (already received bonus)
      const [org] = await tx
        .select({ creditBalance: organization.creditBalance })
        .from(organization)
        .where(eq(organization.id, orgId));

      if (!org) {
        return { success: false, error: "Organization not found" };
      }

      if ((org.creditBalance ?? 0) > 0) {
        // Already has credits, don't double-grant
        return { success: false, error: "Organization already has credits" };
      }

      // Generate and store org ID hash for contract mapping
      const orgIdHash = hashOrgId(orgId);

      // Record bonus transaction
      await tx.insert(creditTransactions).values({
        organizationId: orgId,
        type: "bonus",
        amount: NEW_ORG_BONUS,
        balanceAfter: NEW_ORG_BONUS,
        note: "New organization welcome bonus",
      });

      // Update balance and org ID hash
      await tx
        .update(organization)
        .set({
          creditBalance: NEW_ORG_BONUS,
          orgIdHash,
        })
        .where(eq(organization.id, orgId));

      return { success: true };
    });
  } catch (error) {
    console.error("Error granting new org bonus:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
