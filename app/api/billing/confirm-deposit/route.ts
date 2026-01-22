import { and, eq, sql } from "drizzle-orm";
import { ethers } from "ethers";
import { headers } from "next/headers";
import {
  CONTRACTS,
  CREDITS_ABI,
  getProvider,
  getTokenName,
  hashOrgId,
} from "@/keeperhub/lib/billing/contracts";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTransactions, member, organization } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { txHash, orgId, creditsExpected } = await req.json();

    if (!(txHash && orgId && creditsExpected)) {
      return Response.json(
        { error: "Missing txHash, orgId, or creditsExpected" },
        { status: 400 }
      );
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

    // Check if transaction already processed (prevent double-credit)
    const existing = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.txHash, txHash))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        {
          error: "Transaction already processed",
          credits: existing[0].amount,
        },
        { status: 400 }
      );
    }

    // Verify organization exists
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);

    if (!org) {
      return Response.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Fetch and verify transaction on-chain
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return Response.json(
        { error: "Transaction not found on blockchain" },
        { status: 400 }
      );
    }

    if (receipt.status !== 1) {
      return Response.json(
        { error: "Transaction failed on blockchain" },
        { status: 400 }
      );
    }

    if (receipt.to?.toLowerCase() !== CONTRACTS.credits.toLowerCase()) {
      return Response.json(
        { error: "Transaction not sent to credits contract" },
        { status: 400 }
      );
    }

    // Parse the CreditsDeposited event
    const creditsInterface = new ethers.Interface(CREDITS_ABI);
    let depositEvent: ethers.LogDescription | null = null;

    for (const log of receipt.logs) {
      try {
        const parsed = creditsInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === "CreditsDeposited") {
          depositEvent = parsed;
          break;
        }
      } catch {
        // Skip logs that don't match
      }
    }

    if (!depositEvent) {
      return Response.json(
        { error: "No CreditsDeposited event found in transaction" },
        { status: 400 }
      );
    }

    // Verify org ID matches
    const expectedOrgIdHash = hashOrgId(orgId);
    const eventOrgIdHash = depositEvent.args.orgId;

    if (eventOrgIdHash.toLowerCase() !== expectedOrgIdHash.toLowerCase()) {
      return Response.json(
        { error: "Organization ID mismatch" },
        { status: 400 }
      );
    }

    // Extract event data
    const paymentToken = getTokenName(depositEvent.args.token);
    const paymentAmount = depositEvent.args.amountPaid.toString();
    const usdValue = depositEvent.args.usdValue.toString();

    // Use the exact credits amount the frontend specified (from package selection)
    const creditsAmount = creditsExpected;

    // Credit the organization in a transaction
    const result = await db.transaction(async (tx) => {
      // Get current balance
      const [currentOrg] = await tx
        .select({ creditBalance: organization.creditBalance })
        .from(organization)
        .where(eq(organization.id, orgId));

      const currentBalance = currentOrg?.creditBalance ?? 0;
      const newBalance = currentBalance + creditsAmount;

      // Record transaction
      await tx.insert(creditTransactions).values({
        organizationId: orgId,
        type: "deposit",
        amount: creditsAmount,
        balanceAfter: newBalance,
        txHash,
        paymentToken,
        paymentAmount,
        usdValue,
      });

      // Update organization balance and ensure org ID hash is stored
      await tx
        .update(organization)
        .set({
          creditBalance: newBalance,
          orgIdHash: sql`COALESCE(org_id_hash, ${expectedOrgIdHash})`,
        })
        .where(eq(organization.id, orgId));

      return { newBalance, creditsAmount };
    });

    return Response.json({
      success: true,
      credits: result.creditsAmount,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error confirming deposit:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
