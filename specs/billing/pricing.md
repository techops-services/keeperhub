# KeeperHub Pricing Specification

## Overview

KeeperHub uses a two-part pricing model:
1. **Tier NFTs** - Soulbound NFTs that unlock features
2. **Credits** - Universal currency for workflow runs and gas

No credit card facility. All payments via smart contract (ETH, USDC, USDT, USDS).

## Tier NFTs

| Feature | Developer | Team | Company | Enterprise |
|---------|-----------|------|---------|------------|
| **Annual** | Free | $199 | $449 | Custom |
| **Lifetime** | $99 | $599 | $1,349 | Custom |
| **Users** | 1 | 5 | 25 | Unlimited |
| **Orgs** | 1 | 2 | 5 | 10 |
| **Workflows** | 5 | 50 | Unlimited | Unlimited |
| **Rate limit** | 5/hr | 20/hr | 50/hr | Unlimited |
| **Plugins** | Basic | All | All + Priority | All + Custom |
| **Support** | Community | Dedicated channel | Priority | Dedicated |

### NFT Mechanics

- **Type**: ERC-721 Soulbound (non-transferable)
- **Binding**: Bound to organization's Para wallet address
- **Annual NFTs**: Include `expiresAt` timestamp, must renew yearly
- **Lifetime NFTs**: No expiration, one-time purchase
- **Validation**: Contract checks NFT validity on each workflow run

## Credits

### Credit Packs

| Pack | Price | Credits | Effective Rate | Bonus |
|------|-------|---------|----------------|-------|
| **Starter** | $25 | 2,500 | $0.010/credit | - |
| **Growth** | $100 | 11,000 | $0.009/credit | +10% |
| **Scale** | $500 | 60,000 | $0.0083/credit | +20% |
| **Enterprise** | Custom | Custom | Custom | Negotiated |

### Credit Usage

| Action | Cost |
|--------|------|
| Workflow run | 1 credit |
| On-chain gas | Market rate (credits → ETH via Chainlink oracle) |

### New Organization Bonus

Every new organization receives **2,500 free credits** - enough for:
- 2,500 workflow runs (no on-chain actions), OR
- ~50-250 on-chain transactions (chain dependent), OR
- A mix of both

### Credit Properties

- Credits never expire
- Non-refundable
- Bound to organization
- Stored on-chain

## Payment Methods

Accepted via smart contract:
- ETH (converted at market rate via Chainlink oracle)
- USDC (1:1 USD)
- USDT (1:1 USD)
- USDS (1:1 USD)

## Limit Enforcement

When limits are hit, the UI notifies users and prompts upgrade:

- **Workflow limit**: Blocked from creating new workflows until upgrade
- **Rate limit**: Runs are queued until limit resets or upgrade
- **Low credits**: Warning when balance is low, workflows pause at zero

## Competitive Positioning

| Platform | Free Tier | Paid Model | Our Advantage |
|----------|-----------|------------|---------------|
| Zapier | 100 tasks/mo | $19.99/mo for 750 tasks | More generous free tier |
| n8n | Self-hosted only | €20/mo for 2,500 executions | 2,500 free credits |
| Pabbly | 100 tasks/mo | $249-699 lifetime | Web3-native, NFT ownership |
| Chainlink | None | Gas + 70% premium | Simpler pricing model |

## Revenue Model

1. **Tier NFT Sales** - One-time (lifetime) or annual recurring
2. **Credit Sales** - Usage-based, bulk discounts for volume
3. **Enterprise Contracts** - Custom pricing for large organizations
