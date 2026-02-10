import { desc, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creditTransactions,
  member,
  organization,
  users,
} from "@/lib/db/schema";

async function checkCredits() {
  try {
    // Find the user
    const [user] = await db
      .select()
      .from(users)
      .where(like(users.email, "sasha+org-3%"))
      .limit(1);

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("✅ User found:", {
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Find their organization
    const [membership] = await db
      .select({
        orgId: organization.id,
        orgName: organization.name,
        creditBalance: organization.creditBalance,
        orgIdHash: organization.orgIdHash,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, user.id))
      .limit(1);

    if (!membership) {
      console.log("❌ No organization found for this user");
      return;
    }

    console.log("\n✅ Organization found:", {
      id: membership.orgId,
      name: membership.orgName,
      creditBalance: membership.creditBalance,
      orgIdHash: membership.orgIdHash,
      role: membership.role,
    });

    // Check credit transactions
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, membership.orgId))
      .orderBy(desc(creditTransactions.createdAt));

    console.log(`\n📊 Credit Transactions (${transactions.length}):`);
    for (const tx of transactions) {
      console.log({
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        note: tx.note,
        createdAt: tx.createdAt,
      });
    }

    if (transactions.length === 0) {
      console.log("⚠️  No credit transactions found - bonus was NOT granted");
    } else if (membership.creditBalance === 2500) {
      console.log("\n✅ SUCCESS: 2,500 welcome credits were granted!");
    } else {
      console.log(
        `\n⚠️  Unexpected credit balance: ${membership.creditBalance}`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkCredits();
