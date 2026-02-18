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

## Gas Limit Override

You can set an absolute gas limit per action node:

1. Open the action node configuration (Transfer Native Token, Transfer ERC20 Token, or Write Contract)
2. Expand the **Advanced** section
3. Set the **Gas Limit** field to an absolute gas unit value (e.g. 500000)

### Field Behavior

- **When empty**: The default 2.0x multiplier is applied to the gas estimate at execution time
- **When set**: Your absolute value is used directly as the transaction gas limit, bypassing the multiplier

The field also shows a live gas estimate when enough configuration is filled in (network, contract address, function, etc.). This helps you choose an appropriate gas limit. If your value is below the current estimate, a warning is shown.

### Example

If the network estimates 100,000 gas for your transaction:

| Gas Limit Setting | Result |
|-------------------|--------|
| Empty (default) | 200,000 (estimate x 2.0) |
| 150,000 | 150,000 (used directly) |
| 500,000 | 500,000 (used directly) |

Setting a gas limit below the estimate will cause the transaction to revert with an out-of-gas error. Setting it close to the estimate risks failure if on-chain state changes between estimation and execution.

## FAQ

### What happens if I leave the gas limit empty?

The default 2.0x multiplier is applied to the gas estimate at execution time. For time-sensitive triggers (event-based, webhook), a 2.5x conservative multiplier is used instead.

### What happens if my gas limit is too low?

The transaction will revert with an "out of gas" error. You will still pay for the gas consumed up to the limit. KeeperHub's retry logic may re-attempt with the default multiplier.

### What happens if my gas limit is too high?

The transaction reserves more gas but only consumes what it needs. Unused gas is refunded. There is no direct cost penalty, but very high limits may cause the transaction to be deprioritized by some networks.

### Does the gas limit affect gas price/fees?

No. The gas limit only sets the maximum gas units. Gas pricing (base fee, priority fee) is handled separately by KeeperHub's adaptive fee strategy and is not configurable through this field.

## Wallet Funding

Ensure your Para wallet has sufficient ETH to cover:

- Transaction gas costs
- Retry attempts
- Potential gas price spikes during network congestion

See [Para Integration](/docs/wallet-management/para) for wallet funding details.
