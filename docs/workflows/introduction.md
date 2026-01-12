---
title: "Introduction to Workflows"
description: "Build sophisticated blockchain automations with the visual workflow builder."
---

# Introduction to Workflows

Workflows are the core of KeeperHub - visual automations that connect triggers, actions, and conditions to create powerful blockchain operations without writing code.

## What are Workflows?

A workflow is a visual representation of an automation. Instead of writing code or managing infrastructure, you build workflows by connecting nodes on a canvas:

- **Triggers** start your workflow (on a schedule, via webhook, on blockchain events, or manually)
- **Actions** perform operations (check balances, call smart contracts, send notifications)
- **Conditions** add branching logic based on action results

## The Visual Workflow Builder

KeeperHub's workflow builder provides an intuitive canvas where you design automations visually:

- **Drag-and-drop nodes** to build your automation flow
- **Connect nodes** with edges to define execution order
- **Configure nodes** using the right-side panel
- **Test workflows** with the Run button before enabling automated execution

## Node Types

### Trigger Nodes

Every workflow starts with a trigger that determines when it runs:

| Trigger | Description |
|---------|-------------|
| Scheduled | Run at intervals (every 5 minutes, hourly, daily, etc.) |
| Webhook | Run when an external service calls your workflow URL |
| Event | Run when a blockchain event is detected |
| Manual | Run only when you click the Run button |

### Action Nodes

Actions perform the actual work in your workflow:

| Category | Actions |
|----------|---------|
| Web3 | Check Balance, Read Contract, Write Contract, Transfer Funds |
| Notifications | Send Email, Send Discord Message, Send Slack Message |
| Integrations | Send Webhook, Custom HTTP requests |

### Condition Nodes

Conditions evaluate results from previous nodes and branch the workflow:

- **Low Balance Condition**: Check if a balance is below a threshold
- **Value Comparison**: Compare any value against a target
- **Custom Logic**: Combine multiple conditions with AND/OR operators

## Building Your First Workflow

1. Click **New Workflow** from the workflow dropdown
2. Add a **Trigger** node to define when your workflow runs
3. Add **Action** nodes to perform operations
4. Optionally add **Condition** nodes to create branching logic
5. Connect nodes by dragging from output to input connectors
6. Configure each node using the right-side panel
7. Enable nodes and click **Run** to test

## AI-Assisted Workflow Creation

Use the **Ask AI...** prompt at the bottom of the canvas to describe what you want to automate. The AI assistant will help you build the workflow structure and suggest node configurations.

## Workflow Hub

Browse the **Hub** to discover workflow templates shared by the community. Import templates to quickly get started with common automation patterns.
