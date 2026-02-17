---
title: "Gas Management"
description: "Understanding gas limit estimation and configuration for blockchain transactions in KeeperHub."
---

# Gas Management

KeeperHub handles gas configuration automatically for all blockchain transactions. This page explains how gas limits are calculated and how to override the defaults when needed.

## How Gas Limit Estimation Works

Every transaction goes through three stages:

1. **Estimate** - KeeperHub calls `eth_estimateGas` on the network to get the minimum gas units required
2. **Multiply** - The estimate is multiplied by a safety factor (the gas limit multiplier) to account for on-chain state changes between estimation and execution
3. **Submit** - The final gas limit is set on the transaction

```
Final Gas Limit = Estimated Gas x Multiplier
```

The multiplier exists because gas estimates are point-in-time snapshots. Between estimation and on-chain execution, contract state can change (other transactions may execute first), which can increase the actual gas required. Without a buffer, transactions risk running out of gas and reverting -- wasting the gas fee while accomplishing nothing.

## Default Multipliers

Defaults vary by chain type. L2 networks use lower multipliers because their gas estimates tend to be more accurate.

| Chain | Standard Multiplier | Conservative Multiplier |
|-------|-------------------|----------------------|
| Ethereum | 2.0x | 2.5x |
| Polygon | 2.0x | 2.5x |
| Arbitrum | 1.5x | 2.0x |
| Base | 1.5x | 2.0x |

**Standard** multiplier is used for manual triggers and scheduled workflows.

**Conservative** multiplier is used for time-sensitive triggers (event-based, webhook) where retry opportunity is limited and failing the transaction is more costly.

These defaults are resolved in order: database chain config > hardcoded chain overrides > global default (2.0x / 2.5x).

## Gas Limit Multiplier Override

You can override the default multiplier per action node:

1. Open the action node configuration (Transfer Native Token, Transfer ERC20 Token, or Write Contract)
2. Expand the **Advanced** section
3. Set the **Gas Limit Multiplier** field

### Field Behavior

- **Range**: 1.00 to 10.00 (step 0.01)
- **When empty**: Uses the chain default (shown below the input)
- **When set**: Your custom value takes precedence over both standard and conservative defaults
- **Placeholder**: Shows the current chain default, e.g. "Auto (2.0x for Ethereum)"

### Example

If the network estimates 100,000 gas for your transaction:

| Multiplier | Final Gas Limit |
|-----------|----------------|
| 1.00x (minimum) | 100,000 |
| 1.15x (custom) | 115,000 |
| 2.00x (Ethereum default) | 200,000 |
| 10.00x (maximum) | 1,000,000 |

A lower multiplier reduces the maximum gas your transaction can consume (saving costs if the estimate is accurate), but increases the risk of out-of-gas reverts. A higher multiplier provides more headroom but reserves more gas. Unused gas is refunded, so the main cost of over-estimating is opportunity cost (the reserved gas cannot be used by other transactions in the same block).

## FAQ

### Why can't I see the gas estimate at config time?

Gas estimation requires calling the network with the exact transaction parameters (contract address, function, arguments, sender). This can only happen at execution time when all template variables are resolved and the wallet is connected. The multiplier field operates on whatever estimate the network returns at execution time.

### What happens if my multiplier is too low?

The transaction will revert with an "out of gas" error. You will still pay for the gas consumed up to the limit. KeeperHub's retry logic may re-attempt with the default multiplier.

### What happens if my multiplier is too high?

The transaction reserves more gas but only consumes what it needs. Unused gas is refunded. There is no direct cost penalty, but very high limits may cause the transaction to be deprioritized by some networks.

### Does the override affect gas price/fees?

No. The gas limit multiplier only affects the gas limit (maximum gas units). Gas pricing (base fee, priority fee) is handled separately by KeeperHub's adaptive fee strategy and is not configurable through this field.

## Wallet Funding

Ensure your Para wallet has sufficient ETH to cover:

- Transaction gas costs
- Retry attempts
- Potential gas price spikes during network congestion

See [Para Integration](/docs/wallet-management/para) for wallet funding details.
