---
title: "Node Configuration"
description: "Complete guide to configuring workflow nodes - triggers, actions, conditions, and connections."
---

# Node Configuration

This guide covers how to configure nodes in the KeeperHub workflow builder.

## Configuration Panel

Click any node on the canvas to open its configuration panel on the right side of the screen. The panel shows all available settings for that node type.

### Required Fields

Fields marked with an asterisk (*) are required. The workflow cannot run until all required fields are completed.

### Common Fields

All nodes share these configuration options:

| Field | Description |
|-------|-------------|
| Label | Display name shown on the node (e.g., "Check Balance") |
| Description | Optional notes about what this node does |
| Enabled | Toggle to activate or deactivate this node |

## Trigger Configuration

### Scheduled Trigger

| Field | Description |
|-------|-------------|
| Interval | How often the workflow runs |
| Options | Every 5 minutes, 15 minutes, hourly, daily, weekly, or custom cron |

**Custom Cron**: Enter a cron expression for precise scheduling (e.g., `0 9 * * 1-5` for weekdays at 9 AM).

### Webhook Trigger

| Field | Description |
|-------|-------------|
| Webhook URL | Auto-generated URL to trigger this workflow |
| Authentication | Optional API key requirement |

Copy the webhook URL and configure your external service to POST to it.

### Event Trigger

| Field | Description |
|-------|-------------|
| Network * | Blockchain network to monitor |
| Contract Address * | Smart contract to watch for events |
| Event | Specific event to listen for (populated from ABI) |

### Manual Trigger

No additional configuration needed. Click the Run button to execute.

## Web3 Node Configuration

### Check Balance

| Field | Description |
|-------|-------------|
| Service | Web3 |
| Connection * | Your connected wallet (for signing if needed) |
| Network * | Ethereum Mainnet, Sepolia, or other supported network |
| Address * | Wallet address to check balance for |

### Read Contract

| Field | Description |
|-------|-------------|
| Service | Web3 |
| Connection | Your connected wallet |
| Network * | Target blockchain network |
| Contract Address * | Smart contract address |
| Function * | Read function to call (auto-populated from ABI) |
| Parameters | Function input parameters |

KeeperHub automatically fetches the contract ABI from block explorers.

### Write Contract

| Field | Description |
|-------|-------------|
| Service | Web3 |
| Connection * | Wallet connection for signing |
| Network * | Target blockchain network |
| Contract Address * | Smart contract address |
| Function * | Write function to execute |
| Parameters | Function input parameters |
| Gas Limit | Optional gas limit override |

**Important**: Write operations require ETH in your Para wallet for gas fees.

### Transfer Funds

| Field | Description |
|-------|-------------|
| Service | Web3 |
| Connection * | Wallet to send from |
| Network * | Target network |
| To Address * | Recipient address |
| Amount * | Amount to transfer |
| Token | Native (ETH) or token contract address |

## Notification Node Configuration

### Send Email

| Field | Description |
|-------|-------------|
| Connection * | Email provider connection |
| To * | Recipient email address(es) |
| Subject | Email subject line |
| Message | Email body content |

### Send Discord Message

| Field | Description |
|-------|-------------|
| Connection * | Discord webhook connection |
| Message * | Message content to send |

### Send Slack Message

| Field | Description |
|-------|-------------|
| Connection * | Slack workspace connection |
| Channel | Target channel |
| Message * | Message content to send |

## Condition Node Configuration

### Low Balance Condition

| Field | Description |
|-------|-------------|
| Threshold * | Balance value to compare against |
| Operator | Less than, less than or equal |

### Value Comparison

| Field | Description |
|-------|-------------|
| Input | Value from previous node output |
| Operator * | Comparison operator |
| Value * | Target value to compare |

**Available Operators:**
- Equals (==)
- Not equals (!=)
- Greater than (>)
- Greater than or equal (>=)
- Less than (<)
- Less than or equal (<=)
- Contains (for strings)

## Managing Connections

Connections store credentials for external services. Set them up before configuring nodes that require them.

### Adding a Connection

1. Click your profile icon in the top-right corner
2. Select **Connections**
3. Click **Add Connection**
4. Choose the connection type
5. Enter the required credentials
6. Save the connection

### Connection Types

| Type | Required Information |
|------|---------------------|
| Web3 Wallet | Wallet address (Para wallet auto-connected) |
| Email | Provider API key |
| Discord | Webhook URL |
| Slack | Workspace OAuth token |
| Webhook | URL and authentication headers |

### Using Connections in Nodes

When configuring a node:
1. Select the **Connection** field
2. Choose from your saved connections
3. The connection status shows as a green checkmark if valid

## Dynamic Variables

Use dynamic variables in notification messages to include data from your workflow:

| Variable | Description |
|----------|-------------|
| `${balance}` | Current balance from Check Balance node |
| `${address}` | Wallet or contract address |
| `${network}` | Network name |
| `${timestamp}` | Execution timestamp |
| `${workflow_name}` | Name of the workflow |

**Example Message:**
```
Balance Alert: ${address} on ${network} has ${balance} ETH
```

## Enabling and Disabling Nodes

Each node has an **Enabled** toggle:
- **Enabled**: Node executes when the workflow runs
- **Disabled**: Node is skipped during execution

This allows you to temporarily disable parts of a workflow without deleting them.

## Deleting Nodes

Click the **Delete** button at the bottom of the configuration panel to remove a node. This also removes all connections to and from that node.
