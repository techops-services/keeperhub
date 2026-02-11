---
title: "Notification Connections"
description: "Configure Email, Discord, Slack, Telegram, and Webhook connections for KeeperHub notifications."
---

# Notification Connections

KeeperHub supports multiple notification channels. Configure connections to enable notification nodes in your workflows.

## Accessing Connections

1. Click your profile icon in the top-right corner
2. Select **Connections**
3. View existing connections or add new ones

## Available Connection Types

### Email

Send notifications directly to email addresses.

**Setup:**
1. Click **Add Connection** and select Email
2. Configure your email provider settings
3. Save the connection

**Features:**
- Direct delivery to specified addresses
- Customizable subject and message content
- Support for dynamic variables from workflow

### Discord

Send messages to Discord channels via webhooks.

**Setup:**
1. In Discord, go to Server Settings > Integrations > Webhooks
2. Create a new webhook and copy the URL
3. In KeeperHub, add a Discord connection with the webhook URL

**Features:**
- Channel-specific message posting
- Rich message formatting
- Real-time delivery

### Slack

Connect to Slack workspaces for team notifications.

**Setup:**
1. Click **Add Connection** and select Slack
2. Authorize KeeperHub to access your Slack workspace
3. Select default channel (can be changed per node)

**Features:**
- Workspace and channel targeting
- Thread support for organized conversations
- Mention capabilities for urgent alerts

### Telegram

Send messages to Telegram chats and channels via bot API.

**Setup:**
1. Create a Telegram bot using [BotFather](https://core.telegram.org/bots/tutorial)
2. Copy the bot token provided by BotFather
3. In KeeperHub, click **Add Connection** and select Telegram
4. Paste your bot token and save

**Features:**
- Send messages to any chat, group, or channel
- Support for plain text and MarkdownV2 formatting
- Dynamic variables from workflow data

**Configuration Fields:**

| Field | Description |
|-------|-------------|
| Chat ID | Numeric chat ID or `@channelusername` |
| Message | Message content (supports dynamic variables) |
| Parse Mode | Plain text or MarkdownV2 |

**MarkdownV2 Note:** When using MarkdownV2 parse mode, special characters (`.`, `-`, `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `=`, `|`, `{`, `}`, `!`) must be escaped with a backslash (`\`).

### Webhook

Send HTTP requests to any external service.

**Setup:**
1. Click **Add Connection** and select Webhook
2. Configure:
   - **URL**: Must begin with https://
   - **Method**: GET, POST, PUT, etc.
   - **Headers**: Authentication and content-type headers

**Features:**
- Integration with any HTTP-compatible service
- Custom JSON payloads
- Dynamic variables in request body

## Using Connections in Workflows

After setting up connections, use them in notification nodes:

1. Add a notification node to your workflow (Send Email, Send Discord Message, etc.)
2. Click the node to open configuration
3. Select your connection from the **Connection** dropdown
4. Configure the message content

### Connection Status

The configuration panel shows connection status:
- **Green checkmark**: Connection is valid and ready
- **Red indicator**: Connection needs attention (expired, invalid credentials, etc.)

## Dynamic Variables in Messages

Include workflow data in your notifications using variables:

| Variable | Description |
|----------|-------------|
| `${balance}` | Balance value from Check Balance node |
| `${address}` | Wallet or contract address |
| `${network}` | Blockchain network name |
| `${timestamp}` | Execution timestamp |
| `${workflow_name}` | Name of the workflow |
| `${node_name}` | Name of the triggering node |

**Example Discord Message:**
```
Balance Alert: Wallet ${address} on ${network} now has ${balance} ETH
```

## Best Practices

### Redundancy
Configure multiple notification channels for critical workflows. If one channel fails, others will still deliver.

### Testing
Test your connections after setup using a simple workflow with a manual trigger.

### Security
- Use HTTPS for all webhook URLs
- Avoid including sensitive data (private keys, passwords) in notification messages
- Regularly review and rotate webhook URLs if compromised

### Channel Organization
- Use dedicated Discord/Slack channels for KeeperHub alerts
- Consider separate channels for different workflow types (alerts, transactions, monitoring)
