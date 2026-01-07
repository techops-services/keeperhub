# Credit-Based Pricing System - Technical Specification

**Author**: Implementation Team  
**Date**: January 5, 2026  
**Status**: Draft for Team Review  
**Related Work**: Public API (Jacob), Organizations (Tait)

---

## Executive Summary

This spec outlines a **modular, credit-based pricing system** for KeeperHub workflow executions:

- **100 free credits** on signup
- **Cost estimation before execution** with configurable buffer (15% + min 5 credits)
- **Block execution** if insufficient credits (no mid-execution aborts)
- **Modular payment providers** (start with HTTP 402, extend to Stripe/crypto later)
- **Integration with public API** for per-call charging
- **Support for organization billing** via Better Auth

### Key Design Principles

1. **Cost-First Execution**: Estimate → Reserve → Execute → Finalize (never abort mid-execution)
2. **Modular Payment System**: Payment providers are pluggable (402, Stripe, crypto)
3. **Agent-Friendly**: HTTP 402 protocol for machine-to-machine payments
4. **Future-Proof**: Variable cost per operation (free reads, expensive writes)
5. **No Custom Payment Processing**: Use third-party providers only

---

## System Architecture

```
User Request (Execute Workflow)
    ↓
Credit Enforcement Middleware
  1. Estimate workflow cost
  2. Check balance >= (estimate * buffer)
  3. Reserve credits
    ↓
    ├─ Sufficient → Execute Workflow → Deduct & Refund
    └─ Insufficient → Return HTTP 402 Payment Required
```

### Integration Points

```
┌────────────────────────────────────────────────────────────┐
│                    KeeperHub System                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Jacob's Public API ──▶ Credit System ◀── Tait's Orgs     │
│  (per-call charging)    (this spec)       (org billing)    │
│                              │                              │
│                              ▼                              │
│                   Payment Provider Abstraction              │
│                              │                              │
│            ┌─────────────────┼──────────────────┐          │
│            ▼                 ▼                  ▼          │
│       HTTP 402           Stripe             Crypto         │
│       (Phase 1)         (Phase 2)          (Phase 3)       │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### 1. `user_credits` - User Credit Balances

**Purpose**: Track available and reserved credits per user

**Key Fields**:

- `userId` (unique) - References users table
- `balance` - Available credits (not reserved)
- `reservedBalance` - Credits locked during workflow execution
- `totalEarned` - Lifetime audit trail (all credits added)
- `totalSpent` - Lifetime audit trail (all credits used)

**Why `reservedBalance`?** Prevents race conditions when user triggers multiple workflows simultaneously. Credits move from `balance` → `reservedBalance` → deducted on completion.

#### 2. `credit_transactions` - Transaction History

**Purpose**: Full audit trail of all credit movements

**Key Fields**:

- `userId` - Who the transaction is for
- `type` - One of: `signup_bonus`, `purchase`, `reserve`, `deduct`, `refund`, `admin_adjustment`
- `amount` - Credits moved (positive for adds, negative for deductions)
- `balanceBefore` / `balanceAfter` - Snapshot for audit
- `executionId` - Link to workflow execution (if applicable)
- `paymentProviderId` - External payment reference (Stripe charge ID, etc.)
- `metadata` - Flexible JSON for provider-specific data

**Indexes**: On `userId`, `executionId`, `createdAt` for fast queries

#### 3. `workflow_cost_estimates` - Cost Estimation Cache

**Purpose**: Cache workflow cost calculations to avoid recalculation on every execution

**Key Fields**:

- `workflowId` (unique) - Which workflow this estimate is for
- `estimatedCost` - Total credits needed
- `nodesHash` / `edgesHash` - SHA256 hashes to detect workflow changes
- `nodeCount`, `actionNodeCount`, `triggerNodeCount` - Metadata for analysis

**Cache Invalidation**: When workflow nodes/edges change, hash changes → recalculate estimate

#### 4. `payment_providers` - Payment Provider Configuration

**Purpose**: Store configuration for different payment methods (extensibility)

**Key Fields**:

- `name` - Internal ID (e.g., "http_402", "stripe")
- `displayName` - User-facing name
- `enabled` - Feature flag
- `config` - Encrypted provider-specific settings
- `pricingTiers` - JSON array of credit packages

### Schema Extensions

**Add to existing `workflow_executions` table**:

- `estimatedCost` - Credits estimated before execution
- `actualCost` - Credits charged after execution
- `creditTransactionId` - Link to transaction record

---

## Credit Model

### Phase 1: Flat Rate (MVP)

**Simple**: 1 credit = 1 workflow execution

**Rationale**:

- Easy to understand and communicate
- Matches pricing table in requirements (Free: 150 runs, Starter: 1,500 runs)
- Validates system before adding complexity

### Phase 2: Variable Costs (Future)

**Concept**: Different operations cost different amounts

**Examples**:

- **Free**: Triggers, Condition logic, read-only database queries
- **1 credit**: SendEmail, HttpRequest, SlackMessage
- **3 credits**: Web3Transfer (blockchain operations)
- **5 credits**: AIGeneration (expensive external APIs)
- **10 credits**: LongRunningJob (resource intensive)

**Additional Factors**:

- Retry penalty (50% cost per retry)
- Duration-based pricing
- Pass-through costs for external APIs

---

## Cost Estimation Algorithm

### How It Works

**File**: `lib/credit-system/cost-estimator.ts`

**Process**:

1. Calculate SHA256 hash of workflow `nodes` and `edges`
2. Check `workflow_cost_estimates` table for cached result
3. If cache hit and hashes match → return cached estimate
4. If cache miss → calculate fresh estimate
5. Save estimate to cache with hashes
6. Return `{ estimatedCost, requiredBalance, breakdown }`

**Required Balance Calculation**:

- `requiredBalance = estimatedCost + buffer`
- `buffer = max(estimatedCost * 15%, 5 credits)`
- Example: 1 credit workflow needs 1 + 5 = **6 credits minimum**

**Why Buffer?**

- Prevents mid-execution failures if cost slightly exceeds estimate
- Refunded after execution if unused
- Configurable via env vars

### Configuration

**Environment Variables**:

```bash
CREDIT_BASE_EXECUTION_COST=1            # Phase 1: flat rate
CREDIT_ENABLE_VARIABLE_COSTS=false      # Phase 2: per-operation
CREDIT_BUFFER_PERCENTAGE=0.15           # 15% safety margin
CREDIT_MIN_BUFFER_CREDITS=5             # Minimum buffer
```

---

## Credit Enforcement Flow

### Implementation Points

**File**: `lib/credit-system/credit-enforcer.ts`

### Functions to Implement

#### 1. `reserveCreditsForExecution()`

**Called**: Before workflow execution starts

**Logic**:

1. Get cost estimate (with buffer)
2. Query `user_credits` for current balance
3. Check if `balance >= requiredBalance`
4. If insufficient → return error with details (for HTTP 402 response)
5. If sufficient → atomic transaction:
   - Move credits from `balance` to `reservedBalance`
   - Insert `reserve` transaction record
   - Use SQL WHERE clause to prevent race conditions
6. Update `workflow_executions` with `estimatedCost`
7. Return success with reservation ID

**Atomic SQL**: Use `WHERE balance >= requiredBalance` in UPDATE to ensure no double-spend

#### 2. `finalizeExecutionCost()`

**Called**: After workflow execution completes

**Logic**:

1. Get `estimatedCost` from execution record (what was reserved)
2. Calculate actual cost (Phase 1: always 1 credit; Phase 2: sum of node costs)
3. Calculate refund: `refundAmount = reserved - actualCost`
4. Atomic transaction:
   - Deduct actual cost from `reservedBalance`
   - Refund unused amount to `balance`
   - Update `totalSpent`
   - Insert `deduct` transaction
   - Insert `refund` transaction (if refundAmount > 0)
   - Update execution record with `actualCost`

**Edge Case**: If actual cost exceeds estimate (shouldn't happen with buffer), user pays only what was reserved (we eat the overage)

#### 3. `cancelReservation()`

**Called**: If execution fails before starting (e.g., validation error)

**Logic**:

1. Get reserved amount from execution record
2. Move all reserved credits back to balance
3. Insert `refund` transaction
4. Mark execution as cancelled

### Modified API Endpoint

**File**: `app/api/workflow/[workflowId]/execute/route.ts`

**Changes**:

1. Create execution record with `status: "pending"`
2. Call `reserveCreditsForExecution()`
3. If insufficient credits:
   - Update execution to `status: "cancelled"`
   - Return HTTP 402 with payment details (see below)
4. If sufficient credits:
   - Update execution to `status: "running"`
   - Execute workflow in background
   - Return 200 with execution ID

**HTTP 402 Response Format**:

```json
{
  "error": "Insufficient credits",
  "details": {
    "estimatedCost": 1,
    "requiredBalance": 6,
    "currentBalance": 2,
    "message": "Insufficient credits. Required: 6, Available: 2",
    "topUpUrl": "/dashboard/credits/purchase"
  }
}
```

**Response Headers**:

- `Status: 402 Payment Required`
- `X-Credits-Required: 6`
- `X-Credits-Available: 2`
- `X-Credits-Deficit: 4`
- `X-Payment-Url: https://keeperhub.com/dashboard/credits/purchase`

---

## Payment Provider Abstraction

### Interface Design

**File**: `lib/credit-system/payment-provider.interface.ts`

**Interface**: `IPaymentProvider`

**Methods**:

1. `initialize(config)` - Setup with API keys/secrets
2. `createPaymentSession(params)` - Initiate credit purchase, return payment URL
3. `verifyPayment(payload)` - Verify webhook/callback, return verification result
4. `getPricingTiers()` - Return available credit packages
5. `refund(params)` - Handle refunds (optional)

**Why This Design?**

- Each provider (402, Stripe, crypto) implements same interface
- New providers can be added without changing core system
- Registry pattern for provider lookup by ID

### Registry Pattern

**File**: `lib/credit-system/payment-provider-registry.ts`

**Class**: `PaymentProviderRegistry`

**Purpose**: Central registry of all payment providers

**Methods**:

- `register(provider)` - Add provider to registry
- `get(providerId)` - Lookup provider by ID
- `getAll()` - List all providers
- `getEnabled()` - List only enabled providers

**Usage**:

```
Register providers on app startup:
  - paymentProviderRegistry.register(new Http402Provider())
  - paymentProviderRegistry.register(new StripeProvider())  // Phase 2
  - paymentProviderRegistry.register(new CryptoProvider())  // Phase 3

Lookup at runtime:
  - const provider = paymentProviderRegistry.get("http_402")
```

---

## HTTP 402 Implementation (Phase 1)

### Provider Implementation

**File**: `lib/credit-system/providers/http-402-provider.ts`

**Class**: `Http402Provider implements IPaymentProvider`

### How It Works

**Payment Flow**:

1. User tries to execute workflow
2. Insufficient credits → API returns 402
3. Agent/user clicks payment URL
4. Manual credit purchase via dashboard or admin
5. Credits added to account
6. Agent/user retries workflow execution

**Key Methods**:

**`createPaymentSession()`**:

- Generate session ID: `402_{timestamp}_{userId}`
- Build payment URL: `/dashboard/credits/purchase?session={id}&credits={amount}`
- Return session object with 24-hour expiration

**`verifyPayment()`**:

- For 402, verification is manual (admin/user adds credits manually)
- In future X402 integration, this verifies protocol headers

**`getPricingTiers()`**:

- Return hardcoded pricing tiers (can be env var later):
  - 100 credits = $10
  - 500 credits = $45 (+ 50 bonus = 10% discount)
  - 1000 credits = $80 (+ 200 bonus = 20% discount) **[Popular]**
  - 5000 credits = $350 (+ 1250 bonus = 25% discount)

### Why Start with 402?

1. **No compliance overhead** (your requirement) - just HTTP status code
2. **Agent-friendly** - Standard protocol agents understand
3. **Foundation for X402** - Can upgrade to full protocol later
4. **Simple implementation** - Get system working fast
5. **Manual backup** - If automated payment fails, admin can intervene

### Future: X402 Protocol

**Phase 5** (Q3 2026): Full X402 support

- Machine-to-machine payments
- Agent-to-agent credit transfers
- Micropayments for API calls
- Integration with agent marketplaces

---

## API Endpoints

### Credit Management

**1. `GET /api/user/credits`** - Get current balance

- Returns: `{ balance, reservedBalance, totalEarned, totalSpent }`
- Auth: User session required

**2. `GET /api/user/credits/transactions`** - Transaction history

- Query params: `limit`, `offset` (pagination)
- Returns: Array of transactions with type, amount, timestamp
- Auth: User session required

**3. `GET /api/credits/pricing`** - Get pricing tiers

- Query param: `provider` (default: "http_402")
- Returns: Array of credit packages with prices
- Auth: None (public)

**4. `POST /api/credits/purchase`** - Initiate credit purchase

- Body: `{ credits, providerId }`
- Returns: Payment session with URL to redirect user
- Auth: User session required

**5. `POST /api/credits/webhook`** - Payment provider webhook

- Query param: `provider` (which provider is calling)
- Body: Provider-specific webhook payload
- Logic: Verify payment, add credits to user account
- Auth: Provider signature verification

### Workflow Execution (Modified)

**`POST /api/workflow/[workflowId]/execute`** - Execute workflow

**New Logic**:

1. Create execution record (status: "pending")
2. **Reserve credits** (new step)
3. If insufficient → return 402
4. If sufficient → execute workflow
5. Return execution ID

---

## Frontend Integration

### Components to Build

**1. Credit Balance Display** (`components/credits/credit-balance.tsx`)

- Shows: Current balance, reserved credits
- Warning: If balance < 10 credits
- Button: Link to purchase page
- Auto-refresh: Every 30 seconds

**2. Credit Purchase Page** (`app/dashboard/credits/purchase/page.tsx`)

- Display: Pricing tiers in cards
- Highlight: Popular tier
- Button: Initiate purchase (calls `/api/credits/purchase`)
- Redirect: To payment URL from provider

**3. Insufficient Credits Dialog** (`components/credits/insufficient-credits-dialog.tsx`)

- Trigger: When API returns 402
- Display: Estimated cost, current balance, deficit
- Button: Navigate to purchase page

**4. Transaction History** (Optional, Phase 2)

- Table: All credit transactions
- Filters: By type, date range
- Export: CSV for accounting

### API Client Extensions

**File**: `lib/api-client.ts`

**Add**: `creditsApi` object with methods:

- `getBalance()` - Fetch current balance
- `getTransactions(params)` - Fetch history
- `getPricing(provider)` - Fetch pricing tiers
- `purchase(params)` - Initiate purchase

**Integration**: Add to main `api` export

---

## Team Coordination

### Integration with Jacob's Public API

**Jacob's Work**: Exposing public API with documentation

**Integration Point 1: API Key Webhook Route**

**File**: `app/api/workflows/[workflowId]/webhook/route.ts`

**Current**: Validates API key, executes workflow

**Add**: Credit check after validation, before execution

- If insufficient → return 402 to API caller
- Workflow owner pays (not API caller)

**Integration Point 2: Per-Call Charging (Future)**

**Concept**: Charge 1 credit per API call (not just workflow execution)

**Implementation**: Middleware that deducts 1 credit immediately

- If insufficient → return 402
- Applied to all public API routes

**Coordination Needed**:

- Agree on which routes are "public API"
- Decide: Do we charge for read-only endpoints?
- Timing: When does Jacob's work reach this point?

### Integration with Tait's Organizations

**Tait's Work**: Organizations via Better Auth

**Integration Point 1: Organizational Credit Pools (Phase 2)**

**Concept**: Organizations have shared credit balance

**Schema Extension**:

- Add `organizationId` field to `user_credits` table
- Add `scope` field: "user" or "organization"

**Credit Resolution Logic**:

- If workflow belongs to org → use org credits
- Otherwise → use user credits

**Integration Point 2: Organization Billing Dashboard**

**Concept**: Show credit usage per team member

**New Endpoint**: `GET /api/organizations/[orgId]/credits/usage`

- Returns: Credit usage grouped by user
- Auth: Org admin only

**Coordination Needed**:

- When is org feature ready?
- Do we launch credit system before or after orgs?
- Recommendation: Launch credit system first (simpler), add org support in Phase 2

---

## Migration Plan

### Phase 1: Database Migrations

**Steps**:

1. Run `pnpm db:generate` - Drizzle generates migration SQL
2. Review generated migration in `drizzle/` folder
3. Run `pnpm db:push` - Apply to database

**Tables Created**:

- `user_credits`
- `credit_transactions`
- `workflow_cost_estimates`
- `payment_providers`

**Table Modified**:

- `workflow_executions` (add cost tracking columns)

### Phase 2: Backfill Existing Users

**Script**: `scripts/backfill-user-credits.ts`

**Logic**:

1. Query all users from `users` table
2. For each user:
   - Check if credit account exists
   - If not, create with 100 credits
   - Insert signup bonus transaction
3. Log progress

**Run**: `tsx scripts/backfill-user-credits.ts`

### Phase 3: Update Auth Flow

**File**: `lib/auth.ts`

**Modify**: Better Auth config to add hook

**Hook**: After user signup

- Create `user_credits` record with 100 credits
- Insert signup bonus transaction
- Don't fail signup if credit creation fails (log error)

### Phase 4: Deploy & Monitor

**Deployment Checklist**:

1. ✅ Run database migrations
2. ✅ Backfill existing users
3. ✅ Deploy credit system code
4. ✅ Test with test account (try to execute workflow with 0 credits)
5. ✅ Monitor Sentry for errors
6. ✅ Monitor credit transaction logs
7. ✅ Communicate changes to users

**Monitoring**:

- Query credit system stats daily
- Alert if any user has negative balance (shouldn't happen)
- Alert if transaction volume spikes unexpectedly

---

## Future Enhancements

### Phase 2: Variable Cost Per Operation (Q1 2026)

**Features**:

- Free read-only operations
- Expensive operations cost more
- Retry penalty
- Duration-based pricing

**Migration**: Feature flag `CREDIT_ENABLE_VARIABLE_COSTS`

### Phase 3: Stripe Integration (Q2 2026)

**Features**:

- Credit card payments
- Subscription tiers ($25/month, $45/month)
- Auto-reload
- Usage-based billing

**Implementation**: `StripeProvider` class + Stripe webhook handler

### Phase 4: Cryptocurrency Payments (Q2-Q3 2026)

**Features**:

- Accept USDC, USDT, ETH
- mcpay.tech integration
- On-chain verification
- Automatic conversion

**Implementation**: `CryptoMcPayProvider` class + blockchain verification

### Phase 5: Advanced 402 Protocol (Q3 2026)

**Features**:

- Full X402 compliance
- Machine-to-machine payments
- Agent-to-agent transfers
- Micropayments

### Phase 6: Enterprise Features (Q4 2026)

**Features**:

- Organization credit pools (with Tait)
- Team credit allocation
- Cost center tracking
- Invoice generation
- Custom pricing

---

## Configuration Reference

### Environment Variables

```bash
# Cost estimation
CREDIT_BASE_EXECUTION_COST=1
CREDIT_ENABLE_VARIABLE_COSTS=false
CREDIT_BUFFER_PERCENTAGE=0.15
CREDIT_MIN_BUFFER_CREDITS=5

# Payment providers
PAYMENT_PROVIDER_DEFAULT=http_402
PAYMENT_PROVIDER_STRIPE_ENABLED=false
PAYMENT_PROVIDER_CRYPTO_ENABLED=false

# Stripe (Phase 3)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Crypto (Phase 4)
MCPAY_API_KEY=...
MCPAY_WEBHOOK_SECRET=...

# Admin overrides (for testing)
CREDIT_ENFORCEMENT_ENABLED=true
CREDIT_ALLOW_NEGATIVE_BALANCE=false
```

---

## Questions for Team Review

1. **Cost Model**: Is 1 credit = 1 workflow run appropriate for Phase 1?
2. **Buffer Percentage**: Is 15% + min 5 credits the right safety margin?
3. **Payment Flow**: Does HTTP 402 work for agent use cases?
4. **API Integration**: Jacob - how does this fit with your public API timeline?
5. **Org Integration**: Tait - can we launch credits before orgs are ready?
6. **Database Schema**: Any concerns about the proposed tables?
7. **Migration Plan**: Is the rollout strategy safe for production?
8. **Priority**: Which future phases are most important?

---

## Implementation Timeline

**Week 1**: Database schema + migrations + backfill
**Week 2**: Core credit enforcement (estimate, reserve, deduct)
**Week 3**: HTTP 402 provider + API endpoints
**Week 4**: Frontend components + testing
**Week 5**: Integration with Jacob/Tait + deploy

**Total Estimated Effort**: 4-6 weeks (1 developer full-time)

---

## Success Metrics

**Phase 1 Success**:

- ✅ All new users get 100 credits
- ✅ Workflows blocked when credits insufficient
- ✅ No mid-execution aborts due to credits
- ✅ HTTP 402 responses work correctly
- ✅ Credit transactions are accurate
- ✅ No race conditions in credit reservation

**Phase 2+ Success**:

- Credit purchases working (Stripe/crypto)
- Variable costs correctly calculated
- Organization billing operational
- Public API per-call charging working

---

_End of Specification_

**For detailed code examples**, see `CREDIT_SYSTEM_SPECIFICATION.md` (implementation reference).
