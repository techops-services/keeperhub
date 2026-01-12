---
title: "Gas Management"
description: "Understanding and optimizing gas costs for blockchain transactions in KeeperHub."
---

# Gas Management

> **Coming Soon**: Advanced gas management features are currently in development. This page describes planned functionality.

## Current Gas Handling

KeeperHub currently handles gas automatically for all blockchain transactions:

- **Automatic Estimation**: Gas limits are estimated based on transaction type
- **Network-Based Pricing**: Gas prices start at current network averages
- **Retry Logic**: Failed transactions due to gas issues are automatically retried with adjusted parameters

## How Gas Works

### What is Gas

Gas is the fee required to execute transactions on Ethereum and EVM-compatible networks. Every blockchain operation consumes gas:

- Simple ETH transfers use minimal gas
- Smart contract interactions vary based on complexity
- Contract deployments consume significant gas

### Gas Components

**Gas Limit**: Maximum gas units the transaction can consume
**Gas Price**: Cost per gas unit (in gwei)
**Total Cost**: Gas Limit x Gas Price

## Planned Features

### Gas Configuration

Control gas settings per workflow:

- Set maximum gas price thresholds
- Configure gas limit overrides
- Define retry behavior on gas failures

### Gas Analytics

Track gas spending across workflows:

- Gas costs per workflow
- Historical gas usage trends
- Network fee comparisons
- Cost optimization recommendations

### Gas Strategies

Choose execution strategies:

- **Economy**: Wait for lower gas prices
- **Standard**: Use current network averages
- **Fast**: Pay premium for quick confirmation
- **Custom**: Define your own parameters

### Gas Alerts

Monitor gas conditions:

- Alert when gas prices exceed thresholds
- Notify on high gas consumption
- Track unusual gas patterns

### Budget Controls

Manage gas spending:

- Set daily or monthly gas budgets
- Pause workflows when budgets are exceeded
- Allocate budgets per workflow

## Current Best Practices

### Monitoring Costs

- Check wallet balance regularly
- Review run history for transaction costs
- Monitor network gas prices externally

### Reducing Costs

- Schedule non-urgent workflows during low-traffic periods
- Batch operations where possible
- Test workflows on testnets first

### Handling Failures

If transactions fail due to gas:

- KeeperHub automatically retries with adjusted parameters
- Check wallet balance if failures persist
- Review the Runs panel for error details

## Wallet Funding

Ensure your Para wallet has sufficient ETH to cover:

- Transaction gas costs
- Retry attempts
- Potential gas price spikes during network congestion

See [Para Integration](/docs/wallet-management/para) for wallet funding details.

## Providing Feedback

If you have specific gas management needs, please contact support with your requirements.
