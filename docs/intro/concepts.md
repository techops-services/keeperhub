---
title: "Core Concepts"
description: "Learn about Workflows, Nodes, Connections, and other KeeperHub fundamentals for blockchain automation."
---

# Core Concepts

Understanding these core concepts will help you get the most out of KeeperHub.

## Workflows

Workflows are visual automations that you build by connecting nodes on a canvas. Each workflow represents a complete automation - from trigger to actions.

**Key characteristics:**
- Visual, node-based design
- Automatic or manual execution
- Conditional branching for complex logic
- Shareable via the Hub

## Nodes

Nodes are the building blocks of workflows. Each node performs a specific function.

### Trigger Nodes

Every workflow starts with a trigger that determines when it runs:

- **Scheduled**: Run at intervals (every 5 minutes, hourly, daily)
- **Webhook**: Run when an external service calls your workflow URL
- **Event**: Run when a blockchain event is detected
- **Manual**: Run only when you click the Run button

### Action Nodes

Actions perform the actual work in your workflow:

- **Web3 Actions**: Check Balance, Read Contract, Write Contract, Transfer Funds
- **Notification Actions**: Send Email, Send Discord Message, Send Slack Message
- **Integration Actions**: Send Webhook, custom HTTP requests

### Condition Nodes

Conditions evaluate data and create branching paths:

- **Low Balance Condition**: Check if balance is below threshold
- **Value Comparison**: Compare any value against a target
- **Custom Logic**: Combine conditions with AND/OR operators

## Connections

Connections store credentials for external services. Set up connections once and reuse them across workflows.

**Connection types:**
- **Web3**: Wallet connections for blockchain operations
- **Email**: Email provider configuration
- **Discord**: Webhook URLs for Discord channels
- **Slack**: Workspace authorization
- **Webhook**: Custom HTTP endpoint credentials

## Workflow Runs

Each time a workflow executes, it creates a run with detailed logging:

- **Status**: Pending, Running, Success, Error, Cancelled
- **Node Outputs**: Results from each node in the workflow
- **Timing**: Start time, duration, completion time
- **Errors**: Detailed error messages if something fails

## The Hub

The Hub is a marketplace for workflow templates:

- **Browse**: Discover workflows shared by the community
- **Import**: Copy workflows to your account
- **Share**: Publish your workflows for others to use

## AI Assistant

KeeperHub includes an AI assistant to help you build workflows:

- Describe what you want in plain language
- The AI suggests nodes and configurations
- Review and customize the generated workflow

Access the AI via the "Ask AI..." input at the bottom of the canvas.

## Para Wallet

Every KeeperHub account includes a Para wallet:

- **Automatic creation**: Created when you sign up
- **Secure custody**: Multi-party computation (MPC) security
- **Funding**: Top up with ETH to enable gas-consuming operations
- **Management**: View balance, withdraw funds via Settings > Wallet

## Networks

KeeperHub supports multiple blockchain networks:

- **Ethereum Mainnet**: Production network for real transactions
- **Sepolia Testnet**: Test network for development (free test ETH)
- **Base**: Layer 2 network with lower gas fees
- **Arbitrum**: Layer 2 network optimized for DeFi

Always test workflows on a testnet before deploying to Mainnet.
