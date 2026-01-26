# Pricing

KeeperHub uses a simple two-part pricing model: **Tier NFTs** for feature access and **Credits** for usage.

## Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Unified Credit System                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   CREDITS power everything:                                    │
│   • Workflow runs (compute cost)                               │
│   • On-chain gas (market rate conversion)                      │
│                                                                │
│   TIER NFTs unlock:                                            │
│   • More workflows, users, orgs                                │
│   • Higher rate limits                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Tiers

| Feature | Developer | Team | Company | Enterprise |
|---------|-----------|------|---------|------------|
| **Annual** | Free | $225 | $675 | Custom |
| **Lifetime** | $99 | $675 | $2,025 | Custom |
| **Users** | 1 | 5 | 25 | Unlimited |
| **Orgs** | 1 | 2 | 5 | 10 |
| **Workflows** | 5 | 50 | Unlimited | Unlimited |
| **Rate limit** | 5/hr | 20/hr | 50/hr | Unlimited |
| **Plugins** | Basic | All | All + Priority | All + Custom |
| **Support** | Community | Dedicated channel | Priority | Dedicated |

## Credits

Credits are the universal currency for KeeperHub usage. Every action costs credits.

### Credit Costs

| Action | Cost |
|--------|------|
| Workflow run | 1 credit |
| On-chain gas | Market rate (credits → ETH via Chainlink oracle) |

### Credit Packs

| Pack | Price | Credits | Effective Rate | Bonus |
|------|-------|---------|----------------|-------|
| **Starter** | $25 | 2,500 | $0.010/credit | - |
| **Growth** | $100 | 11,000 | $0.009/credit | +10% |
| **Scale** | $500 | 60,000 | $0.0083/credit | +20% |
| **Enterprise** | Custom | Custom | Custom | Negotiated |

### New Organization Bonus

Every new organization receives **2,500 free credits** - enough for:

- 2,500 workflow runs (no on-chain actions), OR
- ~50-250 on-chain transactions (chain dependent), OR
- A mix of both

This gives you plenty of room to explore the platform before purchasing credits.

## Payment Methods

All payments are made via smart contract. We accept:

- ETH
- USDC
- USDT
- USDS

No credit cards required. Fully on-chain and transparent.

## Tier NFTs

Tier access is represented by soulbound (non-transferable) NFTs:

- **Minting**: Purchase via smart contract with stablecoins or ETH
- **Binding**: NFT is bound to your organization's Para wallet
- **Annual NFTs**: Include an expiration timestamp, must renew yearly
- **Lifetime NFTs**: No expiration, one-time purchase

## Limits & Notifications

When you hit a limit, the UI will notify you and prompt an upgrade:

- **Workflow limit**: Blocked from creating new workflows until upgrade
- **Rate limit**: Runs are queued until limit resets or you upgrade
- **Low credits**: Warning when balance is low, workflows pause at zero

## How We Compare

| Platform | Free Tier | Entry Paid | Mid Tier | Model |
|----------|-----------|------------|----------|-------|
| **KeeperHub** | 2,500 credits | $225/yr | $675/yr | NFT + Credits |
| **Zapier** | 100 tasks/mo | $240/yr | $876/yr | Per-task subscription |
| **n8n** | Self-hosted | €240/yr | €600/yr | Per-execution subscription |
| **Pabbly** | 100 tasks/mo | $249 LTD | $699 LTD | Lifetime only |

**Why KeeperHub wins:**
- **25x more generous free tier** - 2,500 credits vs 100 tasks
- **Credits never expire** - Use them whenever you need
- **Lifetime option** - One-time purchase available (Zapier/n8n don't offer this)
- **Web3-native** - Smart contract payments, no credit cards needed

## FAQ

### How do credits convert to gas?

Credits are converted to ETH at the current market rate using Chainlink price feeds. When your workflow executes an on-chain transaction, the required ETH amount is calculated and the equivalent credits are deducted from your balance.

### Can I get a refund?

No. All purchases are final. This is why we provide 2,500 free credits to every new organization - so you can fully explore the platform before purchasing.

### What happens when my annual NFT expires?

Your tier downgrades to Developer. Your workflows remain but any beyond the 5-workflow limit will be paused. Renew your NFT to restore full access.

### Are lifetime NFTs really forever?

Yes. A lifetime NFT never expires and grants permanent access to that tier's features. You still need to purchase credits for usage.
