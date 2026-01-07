# Credit-Based Pricing System Specification

**Author**: Implementation Team  
**Date**: January 5, 2026  
**Status**: Draft for Team Review  
**Related Tickets**: Pricing Tiers Implementation, Public API (Jacob), Organizations (Tait)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Credit Model](#credit-model)
5. [Cost Estimation Algorithm](#cost-estimation-algorithm)
6. [Credit Enforcement](#credit-enforcement)
7. [Payment Provider Abstraction](#payment-provider-abstraction)
8. [HTTP 402 Implementation](#http-402-implementation)
9. [API Endpoints](#api-endpoints)
10. [Frontend Integration](#frontend-integration)
11. [Team Coordination](#team-coordination)
12. [Migration Plan](#migration-plan)
13. [Future Enhancements](#future-enhancements)

---

## Executive Summary

This specification outlines a **modular, credit-based pricing system** for KeeperHub workflow executions. The system will:

- **Assign 100 free credits** to new users on signup
- **Estimate workflow execution costs** before running (with configurable buffer)
- **Block execution** if insufficient credits (no mid-execution aborts)
- **Support modular payment providers** (start with HTTP 402, extend to Stripe/crypto)
- **Integrate with public API** (Jacob's work) for per-call charging
- **Support organization billing** (Tait's work) via Better Auth

### Key Design Principles

1. **Modular Payment System**: Payment providers are pluggable (402, Stripe, crypto)
2. **Cost-First Execution**: Estimate before run, validate balance, never abort mid-execution
3. **Agent-Friendly**: HTTP 402 protocol for agent authentication and payment
4. **Future-Proof**: Variable cost per operation (free reads, expensive writes)
5. **No Custom Payment Processing**: Use third-party providers only

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                             │
│                    (Execute Workflow)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Credit Enforcement Middleware                  │
│  1. Estimate workflow cost (analyze nodes/edges)                │
│  2. Check balance >= (estimate * buffer)                        │
│  3. Reserve credits (optimistic lock)                           │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ Sufficient                  │ Insufficient
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  Execute Workflow         │   │  Return HTTP 402                │
│  - Track actual cost      │   │  - Payment URL                  │
│  - Deduct on completion   │   │  - Estimated cost               │
│  - Refund unused reserve  │   │  - Current balance              │
└───────────────────────────┘   └─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Credit Transaction Log                        │
│  - Timestamp                                                     │
│  - Type (reserve, deduct, refund, purchase)                     │
│  - Amount                                                        │
│  - Related execution ID                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

```
┌────────────────────────────────────────────────────────────────┐
│                      KeeperHub System                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌─────────────────┐   ┌──────────────┐ │
│  │   Jacob's    │────▶│  Credit System  │◀──│   Tait's     │ │
│  │  Public API  │     │  (This Spec)    │   │  Org Support │ │
│  │              │     │                 │   │              │ │
│  │ - Per-call   │     │ - Balance check │   │ - Org billing│ │
│  │   charging   │     │ - Cost estimate │   │ - Shared     │ │
│  │ - Agent auth │     │ - 402 responses │   │   credits    │ │
│  └──────────────┘     └─────────────────┘   └──────────────┘ │
│                              │                                 │
│                              ▼                                 │
│                    ┌──────────────────┐                        │
│                    │ Payment Provider │                        │
│                    │   Abstraction    │                        │
│                    └────────┬─────────┘                        │
│                             │                                  │
│       ┌─────────────────────┼─────────────────────┐           │
│       │                     │                     │           │
│       ▼                     ▼                     ▼           │
│  ┌─────────┐         ┌──────────┐        ┌──────────┐       │
│  │ HTTP 402│         │  Stripe  │        │  Crypto  │       │
│  │ (Phase 1)│        │(Phase 2) │        │(Phase 3) │       │
│  └─────────┘         └──────────┘        └──────────┘       │
│                                                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### `user_credits` - User Credit Balances

```typescript
export const userCredits = pgTable("user_credits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(100), // Free credits on signup
  reservedBalance: integer("reserved_balance").notNull().default(0), // Reserved during execution
  totalEarned: integer("total_earned").notNull().default(100), // Lifetime earned credits
  totalSpent: integer("total_spent").notNull().default(0), // Lifetime spent credits
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Type exports
export type UserCredit = typeof userCredits.$inferSelect;
export type NewUserCredit = typeof userCredits.$inferInsert;
```

**Key Fields:**

- `balance`: Available credits (not reserved)
- `reservedBalance`: Credits locked during workflow execution
- `totalEarned`: Audit trail of all credits added
- `totalSpent`: Audit trail of all credits used

#### `credit_transactions` - Transaction History

```typescript
export const creditTransactions = pgTable("credit_transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type")
    .notNull()
    .$type<
      | "signup_bonus"
      | "purchase"
      | "reserve"
      | "deduct"
      | "refund"
      | "admin_adjustment"
    >(),
  amount: integer("amount").notNull(), // Positive for adds, negative for deductions
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  description: text("description"),

  // Related entities
  executionId: text("execution_id").references(() => workflowExecutions.id, {
    onDelete: "set null",
  }),
  paymentProviderId: text("payment_provider_id"), // Reference to external payment (Stripe charge ID, etc)

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Flexible for provider-specific data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Indexes for performance
export const creditTransactionIndexes = {
  byUser: index("idx_credit_transactions_user_id").on(
    creditTransactions.userId
  ),
  byExecution: index("idx_credit_transactions_execution_id").on(
    creditTransactions.executionId
  ),
  byCreatedAt: index("idx_credit_transactions_created_at").on(
    creditTransactions.createdAt
  ),
};

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
```

**Transaction Types:**

- `signup_bonus`: Initial 100 credits
- `purchase`: Credits bought via payment provider
- `reserve`: Credits locked before execution
- `deduct`: Credits consumed after execution
- `refund`: Unused reserved credits returned
- `admin_adjustment`: Manual adjustment by admin

#### `workflow_cost_estimates` - Cost Estimation Cache

```typescript
export const workflowCostEstimates = pgTable("workflow_cost_estimates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),

  // Cost breakdown
  estimatedCost: integer("estimated_cost").notNull(), // Total estimated credits
  baseExecutionCost: integer("base_execution_cost").notNull().default(1), // Base cost per run
  nodesCost: integer("nodes_cost").notNull().default(0), // Cost from individual nodes
  estimatedDuration: integer("estimated_duration"), // Estimated duration in ms (for future pricing)

  // Workflow snapshot for cache invalidation
  nodesHash: text("nodes_hash").notNull(), // Hash of workflow.nodes to detect changes
  edgesHash: text("edges_hash").notNull(), // Hash of workflow.edges to detect changes

  // Metadata
  nodeCount: integer("node_count").notNull(),
  actionNodeCount: integer("action_node_count").notNull(),
  triggerNodeCount: integer("trigger_node_count").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Unique constraint: one estimate per workflow
export const workflowCostEstimateIndexes = {
  byWorkflow: uniqueIndex("idx_workflow_cost_estimates_workflow_id").on(
    workflowCostEstimates.workflowId
  ),
};

export type WorkflowCostEstimate = typeof workflowCostEstimates.$inferSelect;
export type NewWorkflowCostEstimate = typeof workflowCostEstimates.$inferInsert;
```

**Why Cache Estimates?**

- Workflow structure rarely changes
- Expensive to recalculate on every execution
- Invalidate cache when workflow nodes/edges change

#### `payment_providers` - Payment Provider Configuration

```typescript
export const paymentProviders = pgTable("payment_providers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  name: text("name").notNull(), // "http_402", "stripe", "crypto_mcpay"
  displayName: text("display_name").notNull(), // "Credit Card (Stripe)", "Cryptocurrency"
  enabled: boolean("enabled").notNull().default(true),

  // Provider-specific config (encrypted)
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),

  // Pricing tiers (future use)
  pricingTiers: jsonb("pricing_tiers").$type<
    {
      credits: number;
      price: number;
      currency: string;
    }[]
  >(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PaymentProvider = typeof paymentProviders.$inferSelect;
export type NewPaymentProvider = typeof paymentProviders.$inferInsert;
```

### Schema Extensions to Existing Tables

#### `workflow_executions` - Add Cost Tracking

```typescript
// Add these fields to existing workflowExecutions table
export const workflowExecutions = pgTable("workflow_executions", {
  // ... existing fields ...

  // Cost tracking (NEW)
  estimatedCost: integer("estimated_cost"), // Cost estimated before execution
  actualCost: integer("actual_cost"), // Cost charged after execution
  creditTransactionId: text("credit_transaction_id").references(
    () => creditTransactions.id
  ), // Link to deduction transaction
});
```

---

## Credit Model

### Phase 1: Simple Flat Rate (MVP)

**Cost Per Run**: 1 credit = 1 workflow execution

**Rationale**:

- Easy to understand and communicate
- Matches pricing table (Free: 150 runs, Starter: 1,500 runs, etc.)
- Allows us to validate system before adding complexity

### Phase 2: Variable Cost Per Operation (Future)

```typescript
type OperationCost = {
  nodeType: string;
  actionType: string;
  cost: number; // Credits
  reason: string;
};

const OPERATION_COSTS: OperationCost[] = [
  // Free operations
  {
    nodeType: "trigger",
    actionType: "*",
    cost: 0,
    reason: "Triggers are free",
  },
  {
    nodeType: "action",
    actionType: "Condition",
    cost: 0,
    reason: "Logic is free",
  },
  {
    nodeType: "action",
    actionType: "DatabaseQuery",
    cost: 0,
    reason: "Read-only operations free",
  },

  // Standard operations (1 credit)
  {
    nodeType: "action",
    actionType: "SendEmail",
    cost: 1,
    reason: "Standard action",
  },
  {
    nodeType: "action",
    actionType: "HttpRequest",
    cost: 1,
    reason: "Standard action",
  },
  {
    nodeType: "action",
    actionType: "SlackSendMessage",
    cost: 1,
    reason: "Standard action",
  },

  // Expensive operations (2+ credits)
  {
    nodeType: "action",
    actionType: "Web3Transfer",
    cost: 3,
    reason: "Blockchain operations expensive",
  },
  {
    nodeType: "action",
    actionType: "AIGeneration",
    cost: 5,
    reason: "AI calls expensive",
  },
  {
    nodeType: "action",
    actionType: "LongRunningJob",
    cost: 10,
    reason: "Resources intensive",
  },
];

// Retry penalty
const RETRY_COST_MULTIPLIER = 0.5; // Each retry costs 50% of original
```

**Future Cost Factors:**

- **Read vs Write**: Read-only operations free, writes cost credits
- **Execution Duration**: Long-running workflows cost more
- **Retries**: Failed steps that retry consume additional credits
- **External API Costs**: Pass-through costs for AI, blockchain, etc.
- **Resource Usage**: Memory, CPU, storage consumption

---

## Cost Estimation Algorithm

### Implementation: `lib/credit-system/cost-estimator.ts`

```typescript
import { createHash } from "node:crypto";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow-store";
import { db } from "@/lib/db";
import { workflowCostEstimates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Cost estimation configuration
 */
export const COST_CONFIG = {
  // Phase 1: Flat rate
  BASE_EXECUTION_COST: 1, // 1 credit per workflow run

  // Phase 2: Variable costs (disabled for now)
  ENABLE_VARIABLE_COSTS: false,

  // Buffer for safety (prevent mid-execution failures)
  BUFFER_PERCENTAGE: 0.15, // Require 15% more credits than estimate
  MIN_BUFFER_CREDITS: 5, // Minimum 5 credits buffer
} as const;

/**
 * Estimate the cost of a workflow execution
 */
export async function estimateWorkflowCost(
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<{
  estimatedCost: number;
  requiredBalance: number; // With buffer
  breakdown: CostBreakdown;
}> {
  // Calculate hashes for cache invalidation
  const nodesHash = hashNodes(nodes);
  const edgesHash = hashEdges(edges);

  // Check cache first
  const cached = await db.query.workflowCostEstimates.findFirst({
    where: eq(workflowCostEstimates.workflowId, workflowId),
  });

  if (
    cached &&
    cached.nodesHash === nodesHash &&
    cached.edgesHash === edgesHash
  ) {
    console.log("[CostEstimator] Using cached estimate:", cached.estimatedCost);
    return {
      estimatedCost: cached.estimatedCost,
      requiredBalance: calculateRequiredBalance(cached.estimatedCost),
      breakdown: {
        baseCost: cached.baseExecutionCost,
        nodesCost: cached.nodesCost,
        buffer: calculateBuffer(cached.estimatedCost),
      },
    };
  }

  // Calculate fresh estimate
  const breakdown = calculateCostBreakdown(nodes, edges);
  const estimatedCost = breakdown.baseCost + breakdown.nodesCost;
  const requiredBalance = calculateRequiredBalance(estimatedCost);

  // Cache the estimate
  await db
    .insert(workflowCostEstimates)
    .values({
      workflowId,
      estimatedCost,
      baseExecutionCost: breakdown.baseCost,
      nodesCost: breakdown.nodesCost,
      nodesHash,
      edgesHash,
      nodeCount: nodes.length,
      actionNodeCount: nodes.filter((n) => n.data.type === "action").length,
      triggerNodeCount: nodes.filter((n) => n.data.type === "trigger").length,
    })
    .onConflictDoUpdate({
      target: workflowCostEstimates.workflowId,
      set: {
        estimatedCost,
        baseExecutionCost: breakdown.baseCost,
        nodesCost: breakdown.nodesCost,
        nodesHash,
        edgesHash,
        nodeCount: nodes.length,
        actionNodeCount: nodes.filter((n) => n.data.type === "action").length,
        triggerNodeCount: nodes.filter((n) => n.data.type === "trigger").length,
        updatedAt: new Date(),
      },
    });

  return {
    estimatedCost,
    requiredBalance,
    breakdown: {
      ...breakdown,
      buffer: calculateBuffer(estimatedCost),
    },
  };
}

/**
 * Calculate cost breakdown
 */
function calculateCostBreakdown(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): CostBreakdown {
  // Phase 1: Simple flat rate
  if (!COST_CONFIG.ENABLE_VARIABLE_COSTS) {
    return {
      baseCost: COST_CONFIG.BASE_EXECUTION_COST,
      nodesCost: 0,
    };
  }

  // Phase 2: Variable costs per operation
  let nodesCost = 0;
  for (const node of nodes) {
    const cost = getNodeCost(node);
    nodesCost += cost;
  }

  return {
    baseCost: COST_CONFIG.BASE_EXECUTION_COST,
    nodesCost,
  };
}

/**
 * Get cost for a single node (Phase 2)
 */
function getNodeCost(node: WorkflowNode): number {
  if (node.data.type === "trigger") {
    return 0; // Triggers are free
  }

  const actionType = node.data.config?.actionType as string;

  // Default costs (will be configurable in Phase 2)
  const COST_MAP: Record<string, number> = {
    Condition: 0, // Logic is free
    DatabaseQuery: 0, // Read-only is free
    SendEmail: 1,
    HttpRequest: 1,
    SlackSendMessage: 1,
    Web3Transfer: 3,
    AIGeneration: 5,
  };

  return COST_MAP[actionType] ?? 1; // Default to 1 credit
}

/**
 * Calculate required balance with buffer
 */
function calculateRequiredBalance(estimatedCost: number): number {
  const buffer = calculateBuffer(estimatedCost);
  return estimatedCost + buffer;
}

/**
 * Calculate buffer amount
 */
function calculateBuffer(estimatedCost: number): number {
  const percentageBuffer = Math.ceil(
    estimatedCost * COST_CONFIG.BUFFER_PERCENTAGE
  );
  return Math.max(percentageBuffer, COST_CONFIG.MIN_BUFFER_CREDITS);
}

/**
 * Hash nodes for cache invalidation
 */
function hashNodes(nodes: WorkflowNode[]): string {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify(
      nodes.map((n) => ({ id: n.id, type: n.data.type, config: n.data.config }))
    )
  );
  return hash.digest("hex");
}

/**
 * Hash edges for cache invalidation
 */
function hashEdges(edges: WorkflowEdge[]): string {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify(edges.map((e) => ({ source: e.source, target: e.target })))
  );
  return hash.digest("hex");
}

// Types
type CostBreakdown = {
  baseCost: number;
  nodesCost: number;
  buffer?: number;
};
```

### Cost Estimation Examples

**Simple Workflow (1 Trigger + 2 Actions)**

```
Nodes: [Webhook Trigger, Send Email, HTTP Request]
Estimate: 1 credit (flat rate)
Buffer: 1 credit (15% rounded up)
Required Balance: 2 credits
```

**Complex Workflow (Future Variable Costs)**

```
Nodes: [Schedule Trigger, Database Query, Condition, Send Email, Web3 Transfer]
Estimate:
  - Base: 1 credit
  - Database Query: 0 (read-only)
  - Condition: 0 (logic)
  - Send Email: 1
  - Web3 Transfer: 3
  Total: 5 credits
Buffer: 5 credits (15% + min 5)
Required Balance: 10 credits
```

---

## Credit Enforcement

### Implementation: `lib/credit-system/credit-enforcer.ts`

```typescript
import { db } from "@/lib/db";
import {
  userCredits,
  creditTransactions,
  workflowExecutions,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { estimateWorkflowCost } from "./cost-estimator";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow-store";

/**
 * Check if user has sufficient credits and reserve them
 * Returns reservation ID if successful, null if insufficient
 */
export async function reserveCreditsForExecution(
  userId: string,
  workflowId: string,
  executionId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<{
  success: boolean;
  reservationId?: string;
  estimatedCost?: number;
  requiredBalance?: number;
  currentBalance?: number;
  error?: string;
}> {
  // Estimate cost
  const { estimatedCost, requiredBalance, breakdown } =
    await estimateWorkflowCost(workflowId, nodes, edges);

  console.log("[CreditEnforcer] Cost estimate:", {
    workflowId,
    estimatedCost,
    requiredBalance,
    breakdown,
  });

  // Get user's current balance
  const userCredit = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
  });

  if (!userCredit) {
    return {
      success: false,
      error: "User credit account not found",
    };
  }

  const availableBalance = userCredit.balance;

  console.log("[CreditEnforcer] Balance check:", {
    userId,
    availableBalance,
    requiredBalance,
    sufficient: availableBalance >= requiredBalance,
  });

  // Check if sufficient balance
  if (availableBalance < requiredBalance) {
    return {
      success: false,
      estimatedCost,
      requiredBalance,
      currentBalance: availableBalance,
      error: `Insufficient credits. Required: ${requiredBalance}, Available: ${availableBalance}`,
    };
  }

  // Reserve credits (atomic operation)
  // This prevents race conditions when user triggers multiple workflows
  const result = await db
    .transaction(async (tx) => {
      // Update user credits (move from balance to reserved)
      const [updated] = await tx
        .update(userCredits)
        .set({
          balance: sql`${userCredits.balance} - ${requiredBalance}`,
          reservedBalance: sql`${userCredits.reservedBalance} + ${requiredBalance}`,
          updatedAt: new Date(),
        })
        .where(
          sql`${userCredits.userId} = ${userId} AND ${userCredits.balance} >= ${requiredBalance}`
        )
        .returning();

      if (!updated) {
        throw new Error("Failed to reserve credits (race condition)");
      }

      // Log reservation transaction
      const [transaction] = await tx
        .insert(creditTransactions)
        .values({
          userId,
          type: "reserve",
          amount: -requiredBalance,
          balanceBefore: availableBalance,
          balanceAfter: updated.balance,
          description: `Reserved ${requiredBalance} credits for workflow execution`,
          executionId,
          metadata: {
            estimatedCost,
            buffer: requiredBalance - estimatedCost,
          },
        })
        .returning();

      return { updated, transaction };
    })
    .catch((error) => {
      console.error("[CreditEnforcer] Reservation failed:", error);
      return null;
    });

  if (!result) {
    return {
      success: false,
      estimatedCost,
      requiredBalance,
      currentBalance: availableBalance,
      error: "Failed to reserve credits (please try again)",
    };
  }

  console.log("[CreditEnforcer] Credits reserved successfully:", {
    reservationId: result.transaction.id,
    reserved: requiredBalance,
    newBalance: result.updated.balance,
  });

  // Update execution record with cost estimate
  await db
    .update(workflowExecutions)
    .set({ estimatedCost })
    .where(eq(workflowExecutions.id, executionId));

  return {
    success: true,
    reservationId: result.transaction.id,
    estimatedCost,
    requiredBalance,
    currentBalance: result.updated.balance,
  };
}

/**
 * Deduct actual cost after execution and refund unused reserve
 */
export async function finalizeExecutionCost(
  userId: string,
  executionId: string,
  actualCost: number
): Promise<void> {
  console.log("[CreditEnforcer] Finalizing execution cost:", {
    userId,
    executionId,
    actualCost,
  });

  // Get execution to find reservation
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, executionId),
  });

  if (!execution?.estimatedCost) {
    console.error("[CreditEnforcer] No estimated cost found for execution");
    return;
  }

  const reserved = execution.estimatedCost;
  const refundAmount = reserved - actualCost;

  if (refundAmount < 0) {
    console.warn("[CreditEnforcer] Actual cost exceeded estimate!", {
      reserved,
      actualCost,
      overage: -refundAmount,
    });
    // This shouldn't happen if buffer is configured correctly
    // But we don't charge extra - user pays only what was reserved
  }

  await db.transaction(async (tx) => {
    // Get current state
    const userCredit = await tx.query.userCredits.findFirst({
      where: eq(userCredits.userId, userId),
    });

    if (!userCredit) {
      throw new Error("User credit account not found");
    }

    // Deduct actual cost from reserved, refund the rest to balance
    const [updated] = await tx
      .update(userCredits)
      .set({
        reservedBalance: sql`${userCredits.reservedBalance} - ${reserved}`,
        balance:
          refundAmount > 0
            ? sql`${userCredits.balance} + ${refundAmount}`
            : userCredits.balance,
        totalSpent: sql`${userCredits.totalSpent} + ${actualCost}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId))
      .returning();

    // Log deduction
    await tx.insert(creditTransactions).values({
      userId,
      type: "deduct",
      amount: -actualCost,
      balanceBefore: userCredit.balance,
      balanceAfter: updated.balance,
      description: `Workflow execution completed (${actualCost} credits)`,
      executionId,
    });

    // Log refund if any
    if (refundAmount > 0) {
      await tx.insert(creditTransactions).values({
        userId,
        type: "refund",
        amount: refundAmount,
        balanceBefore: updated.balance - refundAmount,
        balanceAfter: updated.balance,
        description: `Refund of unused reserved credits (${refundAmount} credits)`,
        executionId,
      });
    }

    // Update execution record
    await tx
      .update(workflowExecutions)
      .set({
        actualCost,
        creditTransactionId: updated.id,
      })
      .where(eq(workflowExecutions.id, executionId));
  });

  console.log("[CreditEnforcer] Cost finalized:", {
    reserved,
    actualCost,
    refunded: Math.max(0, refundAmount),
  });
}

/**
 * Cancel reservation (if execution fails before starting)
 */
export async function cancelReservation(
  userId: string,
  executionId: string
): Promise<void> {
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, executionId),
  });

  if (!execution?.estimatedCost) {
    return;
  }

  const reserved = execution.estimatedCost;

  await db.transaction(async (tx) => {
    const userCredit = await tx.query.userCredits.findFirst({
      where: eq(userCredits.userId, userId),
    });

    if (!userCredit) return;

    // Return reserved credits to balance
    await tx
      .update(userCredits)
      .set({
        reservedBalance: sql`${userCredits.reservedBalance} - ${reserved}`,
        balance: sql`${userCredits.balance} + ${reserved}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));

    // Log refund
    await tx.insert(creditTransactions).values({
      userId,
      type: "refund",
      amount: reserved,
      balanceBefore: userCredit.balance,
      balanceAfter: userCredit.balance + reserved,
      description: "Execution cancelled, credits refunded",
      executionId,
    });
  });
}
```

### Enforcement Flow

```typescript
// In app/api/workflow/[workflowId]/execute/route.ts

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await context.params;

  // ... existing auth checks ...

  // Parse request
  const body = await request.json().catch(() => ({}));
  const input = body.input || {};

  // Get workflow
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
  });

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Create execution record first (for reservation)
  const [execution] = await db
    .insert(workflowExecutions)
    .values({
      workflowId,
      userId,
      status: "pending", // Not "running" yet - pending credit check
      input,
    })
    .returning();

  // CREDIT CHECK: Reserve credits before execution
  const reservation = await reserveCreditsForExecution(
    userId,
    workflowId,
    execution.id,
    workflow.nodes as WorkflowNode[],
    workflow.edges as WorkflowEdge[]
  );

  if (!reservation.success) {
    // Insufficient credits - return HTTP 402 Payment Required
    await db
      .update(workflowExecutions)
      .set({
        status: "cancelled",
        error: reservation.error,
      })
      .where(eq(workflowExecutions.id, execution.id));

    return NextResponse.json(
      {
        error: "Insufficient credits",
        details: {
          estimatedCost: reservation.estimatedCost,
          requiredBalance: reservation.requiredBalance,
          currentBalance: reservation.currentBalance,
          message: reservation.error,
          topUpUrl: `/dashboard/credits/purchase`, // Frontend URL
        },
      },
      {
        status: 402, // Payment Required
        headers: {
          "X-Credits-Required": String(reservation.requiredBalance),
          "X-Credits-Available": String(reservation.currentBalance),
          "X-Credits-Deficit": String(
            reservation.requiredBalance! - reservation.currentBalance!
          ),
        },
      }
    );
  }

  // Credits reserved successfully - start execution
  await db
    .update(workflowExecutions)
    .set({ status: "running" })
    .where(eq(workflowExecutions.id, execution.id));

  // Execute workflow in background
  executeWorkflowBackground(
    execution.id,
    workflowId,
    workflow.nodes as WorkflowNode[],
    workflow.edges as WorkflowEdge[],
    input
  );

  return NextResponse.json({
    executionId: execution.id,
    status: "running",
    creditsReserved: reservation.estimatedCost,
  });
}
```

---

## Payment Provider Abstraction

### Interface: `lib/credit-system/payment-provider.interface.ts`

```typescript
/**
 * Payment provider interface
 * All payment providers must implement this interface
 */
export interface IPaymentProvider {
  /**
   * Provider identifier (e.g., "http_402", "stripe", "crypto_mcpay")
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly displayName: string;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Create a payment session for purchasing credits
   * @returns Payment URL or session data for frontend
   */
  createPaymentSession(params: {
    userId: string;
    credits: number;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentSession>;

  /**
   * Verify a payment webhook/callback
   * @returns Payment verification result
   */
  verifyPayment(payload: unknown): Promise<PaymentVerification>;

  /**
   * Get available pricing tiers
   */
  getPricingTiers(): Promise<PricingTier[]>;

  /**
   * Handle refund (if supported)
   */
  refund?(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult>;
}

// Types
export type PaymentSession = {
  sessionId: string;
  paymentUrl?: string;
  clientSecret?: string; // For frontend SDK
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
};

export type PaymentVerification = {
  verified: boolean;
  userId: string;
  credits: number;
  amount: number;
  currency: string;
  paymentProviderId: string; // External payment ID (Stripe charge ID, etc.)
  metadata?: Record<string, unknown>;
};

export type PricingTier = {
  credits: number;
  price: number;
  currency: string;
  bonusCredits?: number; // Promotional bonus
  popular?: boolean;
};

export type RefundResult = {
  success: boolean;
  refundId: string;
  amount: number;
};
```

### Registry: `lib/credit-system/payment-provider-registry.ts`

```typescript
import type { IPaymentProvider } from "./payment-provider.interface";
import { Http402Provider } from "./providers/http-402-provider";
// Future imports:
// import { StripeProvider } from "./providers/stripe-provider";
// import { CryptoMcPayProvider } from "./providers/crypto-mcpay-provider";

/**
 * Payment provider registry
 * Centralized registration of all payment providers
 */
class PaymentProviderRegistry {
  private providers = new Map<string, IPaymentProvider>();

  register(provider: IPaymentProvider): void {
    this.providers.set(provider.id, provider);
    console.log(
      `[PaymentProviderRegistry] Registered provider: ${provider.id}`
    );
  }

  get(providerId: string): IPaymentProvider | undefined {
    return this.providers.get(providerId);
  }

  getAll(): IPaymentProvider[] {
    return Array.from(this.providers.values());
  }

  getEnabled(): IPaymentProvider[] {
    // In Phase 1, we only enable HTTP 402
    // In future, check database for enabled providers
    return this.getAll().filter((p) => p.id === "http_402");
  }
}

// Global registry instance
export const paymentProviderRegistry = new PaymentProviderRegistry();

// Register built-in providers
paymentProviderRegistry.register(new Http402Provider());

// Future provider registrations:
// if (process.env.STRIPE_SECRET_KEY) {
//   paymentProviderRegistry.register(new StripeProvider());
// }
// if (process.env.MCPAY_API_KEY) {
//   paymentProviderRegistry.register(new CryptoMcPayProvider());
// }
```

---

## HTTP 402 Implementation

### Provider: `lib/credit-system/providers/http-402-provider.ts`

```typescript
import type {
  IPaymentProvider,
  PaymentSession,
  PaymentVerification,
  PricingTier,
} from "../payment-provider.interface";

/**
 * HTTP 402 Payment Required Provider
 *
 * This provider implements the HTTP 402 status code for payment flows.
 * It's designed for agent-to-agent payments and programmatic credit purchases.
 *
 * Flow:
 * 1. API returns 402 with payment instructions
 * 2. Agent/user visits payment URL
 * 3. Manual credit purchase via admin or self-service
 * 4. Credits added to account
 * 5. Agent retries request
 *
 * Future: Integrate with X402 protocol (https://www.x402.org/)
 */
export class Http402Provider implements IPaymentProvider {
  readonly id = "http_402";
  readonly displayName = "HTTP 402 Payment";

  private config: Record<string, unknown> = {};

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config;
  }

  async createPaymentSession(params: {
    userId: string;
    credits: number;
    amount: number;
    currency: string;
  }): Promise<PaymentSession> {
    // Generate a payment session ID
    const sessionId = `402_${Date.now()}_${params.userId}`;

    // Payment URL directs to credit purchase page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const paymentUrl = `${baseUrl}/dashboard/credits/purchase?session=${sessionId}&credits=${params.credits}`;

    return {
      sessionId,
      paymentUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        provider: this.id,
        userId: params.userId,
        credits: params.credits,
      },
    };
  }

  async verifyPayment(payload: unknown): Promise<PaymentVerification> {
    // For HTTP 402, verification is manual
    // Payment is marked as "verified" when admin/user manually adds credits
    // This method is called from webhook/callback endpoint

    const data = payload as {
      userId: string;
      credits: number;
      paymentMethod: string;
    };

    return {
      verified: true,
      userId: data.userId,
      credits: data.credits,
      amount: 0, // No monetary amount for 402 (manual)
      currency: "USD",
      paymentProviderId: `402_${Date.now()}`,
      metadata: {
        paymentMethod: data.paymentMethod,
        provider: this.id,
      },
    };
  }

  async getPricingTiers(): Promise<PricingTier[]> {
    // Default pricing tiers
    // These can be made configurable via environment variables
    return [
      {
        credits: 100,
        price: 10,
        currency: "USD",
      },
      {
        credits: 500,
        price: 45,
        currency: "USD",
        bonusCredits: 50, // 10% bonus
      },
      {
        credits: 1000,
        price: 80,
        currency: "USD",
        bonusCredits: 200, // 20% bonus
        popular: true,
      },
      {
        credits: 5000,
        price: 350,
        currency: "USD",
        bonusCredits: 1250, // 25% bonus
      },
    ];
  }
}
```

### 402 Response Format

When a user has insufficient credits, the API returns:

```typescript
// HTTP 402 Payment Required
{
  "error": "Insufficient credits",
  "details": {
    "estimatedCost": 5,
    "requiredBalance": 6,
    "currentBalance": 2,
    "message": "Insufficient credits. Required: 6, Available: 2",
    "topUpUrl": "/dashboard/credits/purchase"
  }
}

// Response Headers:
{
  "Status": "402 Payment Required",
  "X-Credits-Required": "6",
  "X-Credits-Available": "2",
  "X-Credits-Deficit": "4",
  "X-Payment-Url": "https://keeperhub.com/dashboard/credits/purchase",
  "X-Payment-Provider": "http_402"
}
```

### Agent Integration Example

```typescript
// Example: Agent calling KeeperHub API
async function executeWorkflow(
  workflowId: string,
  input: Record<string, unknown>
) {
  const response = await fetch(
    `${KEEPERHUB_API}/workflow/${workflowId}/execute`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    }
  );

  if (response.status === 402) {
    // Payment required
    const error = await response.json();
    const paymentUrl = response.headers.get("X-Payment-Url");

    console.log("Insufficient credits!");
    console.log(`Required: ${error.details.requiredBalance}`);
    console.log(`Available: ${error.details.currentBalance}`);
    console.log(`Top up at: ${paymentUrl}`);

    // Agent can:
    // 1. Notify user to purchase credits
    // 2. Automatically purchase credits (if payment method configured)
    // 3. Queue the request for later (when credits available)

    throw new Error(`Payment required: ${error.details.message}`);
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return await response.json();
}
```

---

## API Endpoints

### Credit Management

#### `GET /api/user/credits` - Get User Credit Balance

```typescript
// app/api/user/credits/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { userCredits } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, session.user.id),
  });

  if (!credits) {
    return NextResponse.json(
      { error: "Credit account not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    balance: credits.balance,
    reservedBalance: credits.reservedBalance,
    totalEarned: credits.totalEarned,
    totalSpent: credits.totalSpent,
    availableBalance: credits.balance, // Balance not reserved
  });
}
```

#### `GET /api/user/credits/transactions` - Get Transaction History

```typescript
// app/api/user/credits/transactions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { creditTransactions } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") || "50");
  const offset = Number.parseInt(url.searchParams.get("offset") || "0");

  const transactions = await db.query.creditTransactions.findMany({
    where: eq(creditTransactions.userId, session.user.id),
    orderBy: desc(creditTransactions.createdAt),
    limit,
    offset,
  });

  return NextResponse.json({
    transactions,
    limit,
    offset,
  });
}
```

#### `POST /api/credits/purchase` - Initiate Credit Purchase

```typescript
// app/api/credits/purchase/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { paymentProviderRegistry } from "@/lib/credit-system/payment-provider-registry";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { credits, providerId = "http_402" } = body;

  if (!credits || credits <= 0) {
    return NextResponse.json(
      { error: "Invalid credit amount" },
      { status: 400 }
    );
  }

  // Get payment provider
  const provider = paymentProviderRegistry.get(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: "Payment provider not found" },
      { status: 404 }
    );
  }

  // Get pricing tier
  const tiers = await provider.getPricingTiers();
  const tier = tiers.find((t) => t.credits === credits);

  if (!tier) {
    return NextResponse.json({ error: "Invalid credit tier" }, { status: 400 });
  }

  // Create payment session
  const session = await provider.createPaymentSession({
    userId: session.user.id,
    credits: tier.credits + (tier.bonusCredits || 0),
    amount: tier.price,
    currency: tier.currency,
  });

  return NextResponse.json({
    sessionId: session.sessionId,
    paymentUrl: session.paymentUrl,
    credits: tier.credits,
    bonusCredits: tier.bonusCredits || 0,
    totalCredits: tier.credits + (tier.bonusCredits || 0),
    amount: tier.price,
    currency: tier.currency,
    expiresAt: session.expiresAt,
  });
}
```

#### `GET /api/credits/pricing` - Get Pricing Tiers

```typescript
// app/api/credits/pricing/route.ts
import { NextResponse } from "next/server";
import { paymentProviderRegistry } from "@/lib/credit-system/payment-provider-registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerId = url.searchParams.get("provider") || "http_402";

  const provider = paymentProviderRegistry.get(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: "Payment provider not found" },
      { status: 404 }
    );
  }

  const tiers = await provider.getPricingTiers();

  return NextResponse.json({
    provider: {
      id: provider.id,
      displayName: provider.displayName,
    },
    tiers,
  });
}
```

#### `POST /api/credits/webhook` - Payment Webhook Handler

```typescript
// app/api/credits/webhook/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userCredits, creditTransactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { paymentProviderRegistry } from "@/lib/credit-system/payment-provider-registry";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const providerId = url.searchParams.get("provider") || "http_402";

  const provider = paymentProviderRegistry.get(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: "Payment provider not found" },
      { status: 404 }
    );
  }

  // Get webhook payload (format varies by provider)
  const payload = await request.json();

  // Verify payment with provider
  const verification = await provider.verifyPayment(payload);

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 400 }
    );
  }

  // Add credits to user account
  await db.transaction(async (tx) => {
    // Get current balance
    const current = await tx.query.userCredits.findFirst({
      where: eq(userCredits.userId, verification.userId),
    });

    if (!current) {
      throw new Error("User credit account not found");
    }

    // Update balance
    const [updated] = await tx
      .update(userCredits)
      .set({
        balance: sql`${userCredits.balance} + ${verification.credits}`,
        totalEarned: sql`${userCredits.totalEarned} + ${verification.credits}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, verification.userId))
      .returning();

    // Log transaction
    await tx.insert(creditTransactions).values({
      userId: verification.userId,
      type: "purchase",
      amount: verification.credits,
      balanceBefore: current.balance,
      balanceAfter: updated.balance,
      description: `Purchased ${verification.credits} credits`,
      paymentProviderId: verification.paymentProviderId,
      metadata: verification.metadata,
    });
  });

  return NextResponse.json({
    success: true,
    creditsAdded: verification.credits,
  });
}
```

### Workflow Execution (Modified)

See [Credit Enforcement](#credit-enforcement) section for the modified `POST /api/workflow/[workflowId]/execute` endpoint.

---

## Frontend Integration

### Credit Balance Display

```typescript
// components/credits/credit-balance.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertCircle } from "lucide-react";

export function CreditBalance() {
  const { data: credits, isLoading } = useQuery({
    queryKey: ["user", "credits"],
    queryFn: () => api.user.getCredits(),
    refetchInterval: 30000, // Refresh every 30s
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading balance...</div>;
  }

  if (!credits) {
    return null;
  }

  const isLowBalance = credits.balance < 10;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">
            {credits.balance} Credits
          </div>
          {credits.reservedBalance > 0 && (
            <div className="text-xs text-muted-foreground">
              ({credits.reservedBalance} reserved)
            </div>
          )}
        </div>
      </div>

      {isLowBalance && (
        <Alert variant="destructive" className="py-2 px-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Low balance. Purchase credits to continue.
          </AlertDescription>
        </Alert>
      )}

      <Button size="sm" variant="outline" asChild>
        <a href="/dashboard/credits/purchase">
          Purchase Credits
        </a>
      </Button>
    </div>
  );
}
```

### Credit Purchase Page

```typescript
// app/dashboard/credits/purchase/page.tsx
"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function CreditPurchasePage() {
  const { data: pricing } = useQuery({
    queryKey: ["credits", "pricing"],
    queryFn: () => api.credits.getPricing(),
  });

  const purchaseMutation = useMutation({
    mutationFn: (credits: number) => api.credits.purchase({ credits }),
    onSuccess: (data) => {
      // Redirect to payment URL (402 flow)
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    },
    onError: (error) => {
      toast.error("Purchase failed", {
        description: error.message,
      });
    },
  });

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-8">Purchase Credits</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pricing?.tiers.map((tier) => (
          <Card key={tier.credits} className={tier.popular ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {tier.credits} Credits
                {tier.popular && <Badge>Popular</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                ${tier.price}
              </div>
              {tier.bonusCredits && (
                <div className="text-sm text-green-600 mb-4">
                  +{tier.bonusCredits} bonus credits
                </div>
              )}
              <div className="text-sm text-muted-foreground mb-4">
                Total: {tier.credits + (tier.bonusCredits || 0)} credits
              </div>
              <Button
                className="w-full"
                onClick={() => purchaseMutation.mutate(tier.credits)}
                disabled={purchaseMutation.isPending}
              >
                {purchaseMutation.isPending ? "Processing..." : "Purchase"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Insufficient Credits Dialog

```typescript
// components/credits/insufficient-credits-dialog.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

type InsufficientCreditsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredBalance: number;
  currentBalance: number;
  estimatedCost: number;
};

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  requiredBalance,
  currentBalance,
  estimatedCost,
}: InsufficientCreditsDialogProps) {
  const router = useRouter();

  const deficit = requiredBalance - currentBalance;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Insufficient Credits</AlertDialogTitle>
          <AlertDialogDescription>
            You need {requiredBalance} credits to execute this workflow, but you only have {currentBalance}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated cost:</span>
              <span className="font-medium">{estimatedCost} credits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Safety buffer:</span>
              <span className="font-medium">{requiredBalance - estimatedCost} credits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current balance:</span>
              <span className="font-medium">{currentBalance} credits</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">You need:</span>
              <span className="font-bold text-destructive">{deficit} more credits</span>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => router.push("/dashboard/credits/purchase")}
          >
            Purchase Credits
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### API Client Extensions

```typescript
// lib/api-client.ts (add to existing file)

export const creditsApi = {
  // Get user credit balance
  getBalance: () =>
    apiCall<{
      balance: number;
      reservedBalance: number;
      totalEarned: number;
      totalSpent: number;
      availableBalance: number;
    }>("/api/user/credits"),

  // Get transaction history
  getTransactions: (params?: { limit?: number; offset?: number }) =>
    apiCall<{
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        description: string;
        createdAt: Date;
      }>;
      limit: number;
      offset: number;
    }>(`/api/user/credits/transactions?${new URLSearchParams(params as any)}`),

  // Get pricing tiers
  getPricing: (provider = "http_402") =>
    apiCall<{
      provider: { id: string; displayName: string };
      tiers: Array<{
        credits: number;
        price: number;
        currency: string;
        bonusCredits?: number;
        popular?: boolean;
      }>;
    }>(`/api/credits/pricing?provider=${provider}`),

  // Initiate credit purchase
  purchase: (params: { credits: number; providerId?: string }) =>
    apiCall<{
      sessionId: string;
      paymentUrl: string;
      credits: number;
      bonusCredits: number;
      totalCredits: number;
      amount: number;
      currency: string;
      expiresAt: Date;
    }>("/api/credits/purchase", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};

// Add to main api export
export const api = {
  // ... existing APIs ...
  credits: creditsApi,
};
```

---

## Team Coordination

### Integration with Jacob's Public API

Jacob is working on exposing a public API with documentation. The credit system integrates at these points:

#### 1. API Key Authentication

**Already Implemented**: `app/api/workflows/[workflowId]/webhook/route.ts` validates API keys.

**Credit Check Addition**: Add credit enforcement before executing via API key:

```typescript
// In webhook route (Jacob's public API endpoint)
export async function POST(request: Request) {
  // ... existing API key validation ...

  // CREDIT CHECK: Reserve credits
  const reservation = await reserveCreditsForExecution(
    workflow.userId, // Workflow owner pays, not API caller
    workflowId,
    executionId,
    workflow.nodes,
    workflow.edges
  );

  if (!reservation.success) {
    // Return 402 to API caller (agent)
    return NextResponse.json(
      {
        error: "Insufficient credits",
        details: {
          estimatedCost: reservation.estimatedCost,
          requiredBalance: reservation.requiredBalance,
          currentBalance: reservation.currentBalance,
        },
      },
      {
        status: 402,
        headers: {
          "X-Credits-Required": String(reservation.requiredBalance),
          "X-Credits-Available": String(reservation.currentBalance),
        },
      }
    );
  }

  // ... continue with execution ...
}
```

#### 2. Per-Call Charging (Future)

When Jacob implements per-API-call metering:

```typescript
// Middleware for public API routes
async function creditMiddleware(request: Request, userId: string) {
  const cost = 1; // 1 credit per API call

  // Deduct immediately (no reservation needed for small operations)
  const result = await deductCredits(userId, cost, {
    description: "Public API call",
    metadata: {
      endpoint: request.url,
      method: request.method,
    },
  });

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits for API access",
        details: result,
      }),
      {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return null; // Continue to handler
}
```

### Integration with Tait's Organizations

Tait is implementing organizations via Better Auth. Credit system integrations:

#### 1. Organizational Credit Pools

**Database Extension**: Add `organizationId` field to `user_credits` table:

```typescript
export const userCredits = pgTable("user_credits", {
  // ... existing fields ...

  // Organization support (Phase 2)
  organizationId: text("organization_id").references(() => organizations.id),
  scope: text("scope").$type<"user" | "organization">().default("user"),
});
```

**Credit Resolution**: When executing a workflow, determine whose credits to use:

```typescript
async function getUserCreditsForExecution(
  userId: string,
  workflowId: string
): Promise<{ creditsUserId: string; scope: "user" | "organization" }> {
  // Get workflow to check if it's organizational
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
    with: { user: { with: { organizations: true } } },
  });

  // If workflow belongs to org, use org credits
  if (workflow.organizationId) {
    return {
      creditsUserId: workflow.organizationId,
      scope: "organization",
    };
  }

  // Otherwise use user credits
  return {
    creditsUserId: userId,
    scope: "user",
  };
}
```

#### 2. Organization Billing Dashboard

Tait can display credit usage per organization member:

```typescript
// API endpoint: GET /api/organizations/[orgId]/credits/usage
export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  // ... auth check: user is org admin ...

  // Get all executions by org members
  const executions = await db.query.workflowExecutions.findMany({
    where: and(
      eq(workflowExecutions.organizationId, params.orgId),
      isNotNull(workflowExecutions.actualCost)
    ),
    with: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Group by user
  const usageByUser = executions.reduce(
    (acc, exec) => {
      const userId = exec.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: exec.user,
          totalCost: 0,
          executionCount: 0,
        };
      }
      acc[userId].totalCost += exec.actualCost || 0;
      acc[userId].executionCount += 1;
      return acc;
    },
    {} as Record<string, any>
  );

  return NextResponse.json({
    organizationId: params.orgId,
    usageByUser: Object.values(usageByUser),
  });
}
```

---

## Migration Plan

### Phase 1: Database Migrations

```bash
# Generate migration
pnpm db:generate

# Review generated migration in drizzle/XXXX_add_credit_system.sql

# Apply migration
pnpm db:push
```

**Migration SQL** (automatically generated by Drizzle):

```sql
-- Create user_credits table
CREATE TABLE "user_credits" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "balance" integer NOT NULL DEFAULT 100,
  "reserved_balance" integer NOT NULL DEFAULT 0,
  "total_earned" integer NOT NULL DEFAULT 100,
  "total_spent" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create credit_transactions table
CREATE TABLE "credit_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "balance_before" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "description" text,
  "execution_id" text,
  "payment_provider_id" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_credit_transactions_user_id" ON "credit_transactions" ("user_id");
CREATE INDEX "idx_credit_transactions_execution_id" ON "credit_transactions" ("execution_id");
CREATE INDEX "idx_credit_transactions_created_at" ON "credit_transactions" ("created_at");

-- Create workflow_cost_estimates table
CREATE TABLE "workflow_cost_estimates" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_id" text NOT NULL,
  "estimated_cost" integer NOT NULL,
  "base_execution_cost" integer NOT NULL DEFAULT 1,
  "nodes_cost" integer NOT NULL DEFAULT 0,
  "estimated_duration" integer,
  "nodes_hash" text NOT NULL,
  "edges_hash" text NOT NULL,
  "node_count" integer NOT NULL,
  "action_node_count" integer NOT NULL,
  "trigger_node_count" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_workflow_cost_estimates_workflow_id" ON "workflow_cost_estimates" ("workflow_id");

-- Create payment_providers table
CREATE TABLE "payment_providers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "display_name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "config" jsonb NOT NULL,
  "pricing_tiers" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add cost tracking to workflow_executions
ALTER TABLE "workflow_executions"
  ADD COLUMN "estimated_cost" integer,
  ADD COLUMN "actual_cost" integer,
  ADD COLUMN "credit_transaction_id" text,
  ADD FOREIGN KEY ("credit_transaction_id") REFERENCES "credit_transactions"("id");
```

### Phase 2: Backfill Existing Users

```typescript
// scripts/backfill-user-credits.ts
import { db } from "@/lib/db";
import { users, userCredits, creditTransactions } from "@/lib/db/schema";

async function backfillUserCredits() {
  console.log("[Backfill] Starting user credits backfill...");

  const allUsers = await db.query.users.findMany();

  for (const user of allUsers) {
    // Check if credits already exist
    const existing = await db.query.userCredits.findFirst({
      where: eq(userCredits.userId, user.id),
    });

    if (existing) {
      console.log(`[Backfill] User ${user.id} already has credits, skipping`);
      continue;
    }

    // Create credit account with 100 free credits
    await db.transaction(async (tx) => {
      const [credits] = await tx
        .insert(userCredits)
        .values({
          userId: user.id,
          balance: 100,
          reservedBalance: 0,
          totalEarned: 100,
          totalSpent: 0,
        })
        .returning();

      // Log signup bonus transaction
      await tx.insert(creditTransactions).values({
        userId: user.id,
        type: "signup_bonus",
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        description: "Welcome bonus - 100 free credits",
      });

      console.log(`[Backfill] Created credits for user ${user.id}`);
    });
  }

  console.log("[Backfill] Completed!");
}

backfillUserCredits().catch(console.error);
```

**Run backfill**:

```bash
tsx scripts/backfill-user-credits.ts
```

### Phase 3: Update Auth Flow

```typescript
// lib/auth.ts (modify existing Better Auth config)

export const auth = betterAuth({
  // ... existing config ...

  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-up/email",
        handler: async (ctx) => {
          // Create credit account for new user
          if (ctx.user) {
            await createUserCreditsAccount(ctx.user.id);
          }
        },
      },
    ],
  },
});

// Helper function
async function createUserCreditsAccount(userId: string) {
  try {
    await db.transaction(async (tx) => {
      const [credits] = await tx
        .insert(userCredits)
        .values({
          userId,
          balance: 100, // Free credits
          reservedBalance: 0,
          totalEarned: 100,
          totalSpent: 0,
        })
        .returning();

      await tx.insert(creditTransactions).values({
        userId,
        type: "signup_bonus",
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        description: "Welcome bonus - 100 free credits",
      });

      console.log(`[Auth] Created credit account for user ${userId}`);
    });
  } catch (error) {
    console.error("[Auth] Failed to create credit account:", error);
    // Don't fail signup if credit creation fails
  }
}
```

### Phase 4: Deploy & Monitor

**Deployment Checklist**:

1. ✅ Run database migrations
2. ✅ Backfill existing users
3. ✅ Deploy credit system code
4. ✅ Test credit enforcement with test account
5. ✅ Monitor Sentry for errors
6. ✅ Monitor credit transaction logs
7. ✅ Communicate changes to users

**Monitoring**:

```typescript
// Monitor credit system health
async function monitorCreditSystem() {
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id) as total_users,
      SUM(balance) as total_balance,
      SUM(reserved_balance) as total_reserved,
      AVG(balance) as avg_balance
    FROM user_credits
  `);

  const recentTransactions = await db.execute(sql`
    SELECT
      type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM credit_transactions
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY type
  `);

  console.log("[Monitor] Credit System Stats:", stats);
  console.log("[Monitor] 24h Transactions:", recentTransactions);
}
```

---

## Future Enhancements

### Phase 2: Variable Cost Per Operation

**Implementation Timeline**: Q1 2026

**Features**:

- Free read-only operations (Database Query, Condition, etc.)
- Expensive operations cost more (AI, blockchain, long-running)
- Retry penalty (failed steps that retry cost extra)
- Duration-based pricing (long workflows cost more)

**Migration**:

- Add `ENABLE_VARIABLE_COSTS` flag to config
- Update cost estimator to use operation-specific costs
- Backfill `workflow_cost_estimates` table
- Update frontend to show cost breakdown

### Phase 3: Stripe Integration

**Implementation Timeline**: Q2 2026

**Features**:

- Credit card payments via Stripe Checkout
- Subscription tiers (Starter: $25/month, Pro: $45/month)
- Auto-reload when balance drops below threshold
- Usage-based billing (pay only for what you use)

**Implementation**:

- Create `StripeProvider` class implementing `IPaymentProvider`
- Add Stripe webhook handler (`/api/credits/webhook?provider=stripe`)
- Implement subscription management UI
- Add Stripe customer portal integration

### Phase 4: Cryptocurrency Payments

**Implementation Timeline**: Q2-Q3 2026

**Features**:

- Accept USDC, USDT, ETH for credit purchases
- Integration with mcpay.tech or similar
- On-chain transaction verification
- Automatic conversion to credits

**Implementation**:

- Create `CryptoMcPayProvider` class implementing `IPaymentProvider`
- Add on-chain verification logic
- Implement wallet connection UI
- Add transaction history with blockchain explorer links

### Phase 5: Advanced 402 Protocol

**Implementation Timeline**: Q3 2026

**Features**:

- Full X402 protocol compliance
- Machine-to-machine payments
- Agent-to-agent credit transfers
- Micropayments for API calls

**Implementation**:

- Implement X402 headers and response format
- Add agent payment authentication
- Create agent SDK for seamless payment
- Integrate with agent marketplaces

### Phase 6: Enterprise Features

**Implementation Timeline**: Q4 2026

**Features**:

- Organization credit pools (Tait's work)
- Team credit allocation and limits
- Cost center tracking and reporting
- Invoice generation and accounting export
- Custom pricing tiers for enterprise

**Implementation**:

- Extend credit system to support organizations
- Add RBAC for credit management
- Build admin dashboard for credit management
- Integrate with accounting systems (QuickBooks, Xero)

---

## Appendix

### Configuration Variables

```bash
# Environment Variables for Credit System

# Cost estimation
CREDIT_BASE_EXECUTION_COST=1            # Credits per workflow run
CREDIT_ENABLE_VARIABLE_COSTS=false      # Enable variable costs
CREDIT_BUFFER_PERCENTAGE=0.15           # 15% buffer
CREDIT_MIN_BUFFER_CREDITS=5             # Minimum buffer

# Payment providers
PAYMENT_PROVIDER_DEFAULT=http_402       # Default provider
PAYMENT_PROVIDER_STRIPE_ENABLED=false   # Enable Stripe
PAYMENT_PROVIDER_CRYPTO_ENABLED=false   # Enable crypto

# Stripe (Phase 3)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Crypto payment (Phase 4)
MCPAY_API_KEY=...
MCPAY_WEBHOOK_SECRET=...

# Admin overrides
CREDIT_ENFORCEMENT_ENABLED=true         # Disable for testing
CREDIT_ALLOW_NEGATIVE_BALANCE=false     # Allow overdraft (danger!)
```

### Database Indexes for Performance

```sql
-- Speed up credit balance queries
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

-- Speed up transaction history queries
CREATE INDEX idx_credit_transactions_user_created ON credit_transactions(user_id, created_at DESC);

-- Speed up execution cost lookups
CREATE INDEX idx_workflow_executions_cost ON workflow_executions(actual_cost) WHERE actual_cost IS NOT NULL;

-- Speed up cost estimate cache
CREATE INDEX idx_workflow_cost_estimates_updated ON workflow_cost_estimates(updated_at DESC);
```

### Testing Strategy

```typescript
// tests/integration/credit-system.test.ts

describe("Credit System", () => {
  describe("Cost Estimation", () => {
    it("estimates 1 credit for simple workflow", async () => {
      const estimate = await estimateWorkflowCost(
        "workflow-123",
        [
          { id: "1", data: { type: "trigger" } },
          {
            id: "2",
            data: { type: "action", config: { actionType: "SendEmail" } },
          },
        ],
        [{ source: "1", target: "2" }]
      );

      expect(estimate.estimatedCost).toBe(1);
      expect(estimate.requiredBalance).toBeGreaterThan(1); // With buffer
    });
  });

  describe("Credit Enforcement", () => {
    it("blocks execution with insufficient credits", async () => {
      // Create user with 0 credits
      const user = await createTestUser({ credits: 0 });

      const result = await reserveCreditsForExecution(
        user.id,
        "workflow-123",
        "execution-456",
        testWorkflowNodes,
        testWorkflowEdges
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient credits");
    });

    it("reserves credits successfully", async () => {
      const user = await createTestUser({ credits: 100 });

      const result = await reserveCreditsForExecution(
        user.id,
        "workflow-123",
        "execution-456",
        testWorkflowNodes,
        testWorkflowEdges
      );

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeDefined();

      // Check balance updated
      const credits = await getUserCredits(user.id);
      expect(credits.balance).toBeLessThan(100);
      expect(credits.reservedBalance).toBeGreaterThan(0);
    });

    it("finalizes cost and refunds unused", async () => {
      const user = await createTestUser({ credits: 100 });

      // Reserve 6 credits (1 cost + 5 buffer)
      await reserveCreditsForExecution(user.id, "w-1", "e-1", nodes, edges);

      // Actual cost was only 1
      await finalizeExecutionCost(user.id, "e-1", 1);

      // Check refund
      const credits = await getUserCredits(user.id);
      expect(credits.balance).toBe(99); // 100 - 1
      expect(credits.reservedBalance).toBe(0);
    });
  });

  describe("Payment Providers", () => {
    it("registers HTTP 402 provider", () => {
      const provider = paymentProviderRegistry.get("http_402");
      expect(provider).toBeDefined();
      expect(provider?.displayName).toBe("HTTP 402 Payment");
    });

    it("creates payment session", async () => {
      const provider = paymentProviderRegistry.get("http_402")!;
      const session = await provider.createPaymentSession({
        userId: "user-123",
        credits: 100,
        amount: 10,
        currency: "USD",
      });

      expect(session.sessionId).toBeDefined();
      expect(session.paymentUrl).toContain("/dashboard/credits/purchase");
    });
  });
});
```

---

## Questions for Team Review

Please review this specification and provide feedback on:

1. **Cost Model**: Is 1 credit = 1 workflow run appropriate for Phase 1?
2. **Buffer Percentage**: Is 15% + min 5 credits the right safety margin?
3. **Payment Flow**: Does the HTTP 402 approach work for your agent use cases?
4. **API Integration**: Jacob - does this integrate well with your public API work?
5. **Org Integration**: Tait - does this fit with your organization billing plans?
6. **Database Schema**: Any concerns about the proposed tables and indexes?
7. **Migration Plan**: Is the rollout strategy safe for production?
8. **Future Phases**: Which enhancements are highest priority?

---

**Next Steps**:

1. Team reviews this spec (target: 1-2 days)
2. Incorporate feedback and finalize design
3. Create implementation tasks and estimate effort
4. Begin Phase 1 development
5. Coordinate with Jacob (public API) and Tait (orgs)

---

_End of Specification_
