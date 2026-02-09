# Dynamic Gas Estimation and Credit Pricing System - Implementation Plan

## Overview

Implement a dynamic billing system that calculates workflow execution costs based on:
- Base cost per block/node
- Base cost per function call
- Gas estimation for write functions (with volatility consideration)
- Platform fee percentage

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BILLING_BLOCK_CALL` | Credits per workflow block/node | `1` |
| `BILLING_FUNCTION_CALL` | Credits per function invocation | `1` |
| `BILLING_OVERALL_FEE` | Platform fee percentage | `1` (for 1%) |
| `VOLATILITY_INDICATOR` | Enable volatility-based gas pricing | `true` |

## Architecture

The billing system wraps the existing `AdaptiveGasStrategy` ([gas-strategy.ts:223](keeperhub/lib/web3/gas-strategy.ts#L223)) and adds:
1. Cost calculation service
2. Pre-execution balance check
3. Dynamic UI estimation during workflow creation

```
Workflow Builder UI
        │
        ▼
┌─────────────────────────────┐
│  Cost Estimation Service    │
│  (keeperhub/lib/billing/)   │
├─────────────────────────────┤
│ - Block/node counting       │
│ - Function counting         │
│ - Trigger type detection    │
│ - Gas estimation (writes)   │
│ - Platform fee calculation  │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  AdaptiveGasStrategy        │
│  (existing infrastructure)  │
│  - Volatility analysis      │
│  - Trigger-aware pricing    │
│  - Chain-specific configs   │
└─────────────────────────────┘
```

## Trigger-Type Gas Strategy (From Original Spec)

The existing `AdaptiveGasStrategy` already implements trigger-based gas pricing:

| Trigger Type | Gas Strategy | Reasoning |
|--------------|--------------|-----------|
| **event** | Always conservative (+20% buffer) | Time-sensitive, must execute quickly |
| **webhook** | Always conservative (+20% buffer) | Time-sensitive, must execute quickly |
| **scheduled** | Volatility-based | Can wait for optimal gas price |
| **manual** | Volatility-based | User-initiated, can optimize |

**How it works** (from [gas-strategy.ts:280-305](keeperhub/lib/web3/gas-strategy.ts#L280)):
```typescript
// Time-sensitive triggers always use conservative strategy
if (this.isTimeSensitive(triggerType)) {  // event or webhook
  return this.getConservativeFees(provider, chainConfig);
}

// Check volatility for scheduled/manual triggers
const volatility = await measureVolatility(provider, blockCount);

if (volatility.isVolatile) {
  return this.getConservativeFees(provider, chainConfig);
}

// Low volatility - use percentile-based estimation (cheaper)
return this.getOptimizedFees(provider, chainConfig, volatility);
```

**Integration in Cost Calculator**:
1. Extract trigger type from workflow's trigger node
2. Pass to `AdaptiveGasStrategy.getGasConfig(provider, triggerType, estimatedGas, chainId)`
3. For UI estimation during workflow creation, default to `scheduled` for more accurate cost display
4. At execution time, use actual trigger type

## Implementation Steps

### Phase 1: Cost Calculation Service

**New file**: [keeperhub/lib/billing/cost-calculator.ts](keeperhub/lib/billing/cost-calculator.ts)

```typescript
import { TriggerType, AdaptiveGasStrategy, getGasStrategy } from "@/keeperhub/lib/web3/gas-strategy";

export type WorkflowCostEstimate = {
  blocks: number;          // Number of nodes in workflow
  blockCost: number;       // BILLING_BLOCK_CALL * blocks
  functionCalls: number;   // Number of function invocations
  functionCost: number;    // BILLING_FUNCTION_CALL * functionCalls
  gasCostCredits: number;  // Gas estimate converted to credits (write functions only)
  platformFee: number;     // BILLING_OVERALL_FEE % of total
  totalCredits: number;    // Sum of all costs
  triggerType: TriggerType; // Detected trigger type
  volatilityWarning: boolean; // True if high volatility detected
  gasStrategy: "conservative" | "optimized"; // Which strategy was used
};

export async function estimateWorkflowCost(
  nodes: WorkflowNode[],
  edges: Edge[],
  chainId?: number,
  triggerTypeOverride?: TriggerType  // For UI preview vs execution
): Promise<WorkflowCostEstimate>
```

**Logic**:
1. **Detect trigger type**: Find trigger node, extract type (`cron` -> "scheduled", `webhook` -> "webhook", `event` -> "event")
2. Count blocks: `nodes.filter(n => n.type === "action").length`
3. Count function calls: Analyze node configs for function invocations
4. Identify write functions: Check `functionFilter: "write"` in plugin registry, or ABI `stateMutability !== "view" && stateMutability !== "pure"`
5. For write functions:
   - Call `gasStrategy.getGasConfig(provider, triggerType, estimatedGas, chainId)`
   - Conservative strategy for event/webhook, volatility-based for scheduled
   - Convert gas cost to credits using ETH price feed
6. Apply platform fee: `(blockCost + functionCost + gasCost) * (BILLING_OVERALL_FEE / 100)`

### Phase 2: Modify Credit Service

**Update**: [keeperhub/lib/billing/credit-service.ts](keeperhub/lib/billing/credit-service.ts#L30)

Replace fixed 1-credit deduction with dynamic amount:

```typescript
export type DeductCreditParams = {
  organizationId: string;
  workflowId?: string | null;
  executionId?: string | null;
  amount: number;  // NEW: Dynamic credit amount
  breakdown?: {    // NEW: Cost breakdown for logging
    blocks: number;
    functionCalls: number;
    gasCost: number;
    platformFee: number;
    gasStrategy: "conservative" | "optimized";
  };
};
```

### Phase 3: Pre-Execution Balance Check

**Update**: [app/api/workflow/[workflowId]/execute/route.ts](app/api/workflow/[workflowId]/execute/route.ts)

Before execution:
1. Detect actual trigger type from the execution context
2. Call `estimateWorkflowCost()` with workflow nodes and trigger type
3. Check `org.creditBalance >= estimate.totalCredits`
4. Return 402 with cost details if insufficient

```typescript
// Detect trigger type from execution context
const triggerType: TriggerType = executionContext.source === "webhook"
  ? "webhook"
  : executionContext.source === "event"
  ? "event"
  : executionContext.source === "manual"
  ? "manual"
  : "scheduled";

const estimate = await estimateWorkflowCost(
  workflow.nodes,
  workflow.edges,
  chainId,
  triggerType
);

if (org.creditBalance < estimate.totalCredits) {
  return Response.json({
    error: "Insufficient credits",
    required: estimate.totalCredits,
    currentBalance: org.creditBalance,
    breakdown: estimate,
    gasStrategy: estimate.gasStrategy, // Show if conservative or optimized
  }, { status: 402 });
}
```

### Phase 4: Database Schema Updates

**Update**: [keeperhub/db/custom-schema.ts](keeperhub/db/custom-schema.ts)

Add cost tracking to `creditTransactions`:
```typescript
// Already exists but enhance note/metadata
{
  note: "Workflow execution - 3 blocks, 2 functions, 450 gas credits, 5 fee (conservative)",
  // Or add structured metadata column
}
```

Add to `workflowExecutions`:
```typescript
estimatedCost: integer("estimated_cost"),
actualCost: integer("actual_cost"),
costBreakdown: json("cost_breakdown"),
gasStrategy: text("gas_strategy"), // "conservative" | "optimized"
```

### Phase 5: UI - Dynamic Cost Estimation

**New component**: [keeperhub/components/billing/workflow-cost-estimate.tsx](keeperhub/components/billing/workflow-cost-estimate.tsx)

Display in workflow builder sidebar:
- Block count and cost
- Function call count and cost
- Estimated gas cost (for write functions)
- Platform fee
- Total estimated credits
- Trigger type indicator
- Gas strategy indicator (conservative vs optimized)
- Volatility warning indicator

**Trigger type display**:
```
┌─────────────────────────────────────┐
│ ESTIMATED COST                      │
├─────────────────────────────────────┤
│ Trigger: Scheduled (Cron)           │
│ Gas Strategy: Optimized             │
│                                     │
│ Blocks (3):           3 credits     │
│ Function calls (2):   2 credits     │
│ Gas (write tx):     450 credits     │
│ Platform fee (1%):    5 credits     │
│ ─────────────────────────────       │
│ TOTAL:              460 credits     │
│                                     │
│ Low volatility - using optimized    │
│    gas pricing. Event/webhook       │
│    triggers use conservative        │
│    pricing (+20% buffer).           │
└─────────────────────────────────────┘
```

**Integration points**:
- [components/workflow/workflow-sidebar.tsx](components/workflow/workflow-sidebar.tsx) - Add cost estimate panel
- Trigger recalculation on node/edge changes
- Update gas strategy display when trigger type changes

### Phase 6: ETH Price Feed Integration

**New file**: [keeperhub/lib/billing/price-feed.ts](keeperhub/lib/billing/price-feed.ts)

Options:
1. Chainlink price feed (on-chain, most reliable)
2. CoinGecko API (off-chain, simpler)
3. Redis-cached price with TTL (performance)

```typescript
export async function getEthPriceUsd(): Promise<number>
export function gasToCredits(gasLimit: bigint, gasPrice: bigint, ethPrice: number): number
```

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `keeperhub/lib/billing/cost-calculator.ts` | Create | Cost estimation logic with trigger-aware gas |
| `keeperhub/lib/billing/price-feed.ts` | Create | ETH price feed integration |
| `keeperhub/lib/billing/credit-service.ts` | Modify | Dynamic credit amounts |
| `app/api/workflow/[workflowId]/execute/route.ts` | Modify | Pre-execution check with trigger type |
| `keeperhub/components/billing/workflow-cost-estimate.tsx` | Create | UI component with gas strategy display |
| `components/workflow/workflow-sidebar.tsx` | Modify | Integrate cost estimate |
| `keeperhub/db/custom-schema.ts` | Modify | Add cost tracking columns |

## Verification

1. **Unit tests**: Test cost calculation with various trigger types and volatility levels
2. **Integration test**:
   - Execute scheduled workflow with low volatility -> optimized gas pricing
   - Execute webhook workflow -> always conservative pricing
   - Execute during high volatility -> conservative pricing regardless of trigger
3. **UI test**: Verify cost estimate updates when trigger type changes
4. **Edge cases**:
   - Empty workflow (trigger only)
   - No write functions (no gas cost)
   - High volatility (conservative pricing, warning displayed)
   - Event trigger (always conservative, even in low volatility)
   - Insufficient credits (402 response with breakdown)

## Key Points Summary

1. **Block** = workflow node (trigger or action)
2. **Function call** = each action node with a callable function
3. **Write function detection** = `functionFilter: "write"` or ABI `stateMutability !== "view" && stateMutability !== "pure"`
4. **Trigger-based gas strategy**:
   - Event/webhook: Always conservative (+20% buffer)
   - Scheduled/manual: Volatility-based (optimized when stable, conservative when volatile)
5. **Volatility threshold**: CV >= 0.3 triggers conservative pricing (from existing `AdaptiveGasStrategy`)
