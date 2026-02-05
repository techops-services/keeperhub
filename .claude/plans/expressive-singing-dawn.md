# Billing UI Polish - 14 Items

## Files to Modify

1. `keeperhub/components/billing/workflow-cost-estimate.tsx` - Cost estimate panel (items 1-6)
2. `keeperhub/lib/billing/contracts.ts` - Token metadata (item 7)
3. `keeperhub/components/billing/buy-credits-dialog.tsx` - Buy credits dialog (items 7-12)
4. `app/(authenticated)/billing/checkout/page.tsx` - Checkout page (items 7-14)
5. `keeperhub/lib/billing/cost-calculator.ts` - `formatCostNote` uses "blocks" (item 1)

---

## Item 1: "Blocks" -> "Actions"

**Files**: `workflow-cost-estimate.tsx`, `cost-calculator.ts`

- Line 448: `Blocks ({baseEstimate.blocks})` -> `Actions ({baseEstimate.blocks})`
- `cost-calculator.ts` line 549: `formatCostNote` uses `"blocks"` -> `"actions"`
- Keep internal variable names (`blocks`, `blockCost`) as-is to avoid API breakage

## Item 2: "Estimated Cost" -> "Estimated Cost per Run"

**File**: `workflow-cost-estimate.tsx` line 410

- Change `"Estimated Cost"` to `"Estimated Cost per Run"`

## Item 3: Lightning icon replacement

**File**: `workflow-cost-estimate.tsx` line 409

- Replace `Zap` (lightning) with `Coins` from lucide-react
- Change `text-amber-500` to `text-muted-foreground` for the icon (no yellow)

## Item 4: Circle icons with tooltips for cost line items

**File**: `workflow-cost-estimate.tsx` lines 445-484

Each breakdown row (Actions, Functions, Gas, Platform Fee) gets:
- A small circle icon (use `CircleDot` from lucide-react, `h-3 w-3 text-muted-foreground`)
- Wrap label text in a `<Tooltip>` explaining:
  - **Actions**: "Each workflow action node costs 1 credit per execution"
  - **Functions**: "Each plugin function call costs 1 credit per execution"
  - **Gas**: "Blockchain gas fees for on-chain write transactions, converted to credits"
  - **Platform Fee**: "A 1% platform fee applied to the total cost"

Pattern: use existing `<Tooltip>` / `<TooltipTrigger>` / `<TooltipContent>` already imported. Add `cursor-help underline decoration-dotted` to label spans.

## Item 5: Total shows "X credits" not just "X"

**File**: `workflow-cost-estimate.tsx` line 433

- Change `{formatCredits(totalCredits)}` to `{formatCredits(totalCredits)} credits`

## Item 6: Remove validation from credit component

**File**: `workflow-cost-estimate.tsx`

- In `GasCostDisplay`: When `configuredWriteFunctions === 0`, return `0 credits` instead of the "configure function" tooltip link (lines 208-222)
- Remove the volatility warning block entirely (lines 505-513) - validation belongs at trigger/enable time, not in the cost display
- Remove the `AlertTriangle` import if no longer used

## Item 7: Use TrustWallet logo URLs for stablecoin icons

**File**: `keeperhub/lib/billing/contracts.ts` lines 30-52

Change `SUPPORTED_TOKENS` to include `logoUrl` instead of emoji `icon`:
```typescript
export const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
    disabledOnSepolia: false,
  },
  // ... same for USDT, USDS
]
```

**Files**: `buy-credits-dialog.tsx` lines 493-496, `checkout/page.tsx` lines 598-603

Replace `<span>{token.icon}</span>` with:
```tsx
<Image alt={token.symbol} src={token.logoUrl} width={16} height={16} className="h-4 w-4 rounded-full" />
```

Uses existing pattern from `wallet-overlay.tsx` and `token-select-field.tsx`.

## Item 8: Shorten error toasts for failed minting

**File**: `checkout/page.tsx` lines 308-311

Change:
```typescript
toast.error(`Failed to mint ${token}: ${error.message}`);
```
To:
```typescript
toast.error(`Failed to mint ${token}. Please try again.`);
```

Apply same pattern to all `onError` callbacks in `buy-credits-dialog.tsx` - strip `error.message` from user-facing toasts. Keep `console.error` for debugging.

Affected toast calls:
- `checkout/page.tsx` line 310: mint error
- `checkout/page.tsx` line 349: approval error
- `checkout/page.tsx` line 396, 424: transaction error
- `buy-credits-dialog.tsx` line 266: approval error
- `buy-credits-dialog.tsx` line 307, 334: transaction error

## Item 9: Loader inside approval button, not below

**File**: `checkout/page.tsx` lines 713-718

Remove the standalone loading div below the approval button:
```tsx
{isApprovalPending && (
  <div className="flex items-center justify-center gap-2 ...">
    <div className="h-4 w-4 animate-spin ..." />
    Waiting for blockchain confirmation...
  </div>
)}
```

Instead, show `<Spinner>` inside the approval button text when `isApprovalPending`:
```tsx
{isApprovalPending && <Spinner className="mr-2 h-4 w-4" />}
Confirming approval...
```
(Already partially done - button text changes to "Confirming approval..." but the external loader duplicates it.)

## Item 10: Tooltip for Approve button

**Files**: `checkout/page.tsx`, `buy-credits-dialog.tsx`

Wrap the Approve button in a `<Tooltip>` explaining:
"Token approval allows the credits contract to transfer {selectedToken} on your behalf. This is a one-time permission for this amount."

## Item 11: Show "Approved" state instead of hiding

**Files**: `checkout/page.tsx`, `buy-credits-dialog.tsx`

When `!needsApproval && isStablecoinPayment`:
- Show a disabled button with checkmark: `<Check className="mr-2 h-4 w-4" /> {selectedToken} Approved`
- Use `variant="outline"` with green text: `text-green-600 dark:text-green-400`

In `checkout/page.tsx`: The approval button is inside `{needsApproval && (...)}`. Change to always show for stablecoin, but toggle between approve/approved states.

In `buy-credits-dialog.tsx`: Same pattern - show approved state instead of hiding.

## Item 12: Replace custom spinners with `<Spinner>` component

**Files**: `buy-credits-dialog.tsx`, `checkout/page.tsx`

Replace all instances of:
```tsx
<div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
```
With:
```tsx
<Spinner className="mx-auto h-8 w-8" />
```

Also replace `<div className="h-4 w-4 animate-spin rounded-full border-primary border-b-2" />` with `<Spinner className="h-4 w-4" />`.

Locations:
- `buy-credits-dialog.tsx` line 416 (calculating spinner)
- `buy-credits-dialog.tsx` line 671 (processing spinner)
- `checkout/page.tsx` line 489 (calculating spinner)
- `checkout/page.tsx` line 516 (processing payment spinner)
- `checkout/page.tsx` line 715 (approval pending spinner)
- `checkout/page.tsx` line 780 (suspense fallback spinner)

Import `Spinner` from `@/components/ui/spinner` in both files.

## Item 13: Minting section becomes a dialog

**File**: `checkout/page.tsx` lines 612-644

Replace the inline minting section with:
1. A small trigger button: "Need test tokens?" with a `FlaskConical` icon
2. A `<Dialog>` that opens with the minting options
3. Move the yellow-bordered content into `<DialogContent>`

This declutters the main checkout flow.

## Item 14: Consistent icons and colors (no emojis)

**Files**: `checkout/page.tsx`, `buy-credits-dialog.tsx`

Replace all emoji usage with lucide-react icons:
- `⚠️` -> `<AlertTriangle className="h-4 w-4 shrink-0" />` (already imported in some files)
- `🧪` -> `<FlaskConical className="h-4 w-4" />` from lucide-react
- `✕` (line 445) -> `<X className="h-6 w-6" />` or keep as text but style consistently
- `✓` (line 507, 692) -> `<Check className="h-6 w-6" />` (already imported)

For warning boxes, standardize on amber (already the project's warning color):
- `bg-yellow-500/10 text-yellow-600` -> `bg-amber-500/10 text-amber-600 dark:text-amber-400`
- `border-yellow-500/50 bg-yellow-500/5` -> `border-amber-500/50 bg-amber-500/5`
- `text-yellow-700 dark:text-yellow-400` -> `text-amber-700 dark:text-amber-400`

---

## Verification

1. `pnpm check` - lint passes
2. `pnpm type-check` - TypeScript passes
3. Visual check: Open workflow editor, add action nodes, verify cost estimate panel shows "Actions" not "Blocks", shows "Estimated Cost per Run", uses `Coins` icon, has tooltips on each line item, total says "X credits"
4. Visual check: Open `/billing/checkout?amount=25`, verify stablecoin icons use TrustWallet logos, minting is in a dialog, spinners use `<Spinner>`, approval shows "Approved" state, warnings use `AlertTriangle` icon with amber colors
5. `pnpm test` - existing tests pass
