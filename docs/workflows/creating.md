---
title: "Creating Workflows"
description: "Step-by-step guide to building workflows with the visual node-based editor."
---

# Creating Workflows

This guide walks you through creating workflows using KeeperHub's visual workflow builder.

## Getting Started

1. Click the workflow dropdown in the top-left corner
2. Select **New Workflow** to create a blank workflow
3. The visual canvas opens with zoom controls and the AI assistant

## The Workflow Canvas

### Navigation

- **Zoom**: Use the +/- buttons in the bottom-left, or scroll to zoom
- **Pan**: Click and drag on empty canvas space to move around
- **Fit**: Click the fit button to center all nodes in view

### Top Toolbar

| Button | Function |
|--------|----------|
| + | Add a new node |
| Undo/Redo | Undo or redo recent changes |
| Save | Save current workflow state |
| Download | Export workflow as JSON |
| Lock | Lock workflow to prevent edits |
| Run | Execute the workflow manually |

## Adding Nodes

Add nodes to your workflow using any of these methods:

### Method 1: Toolbar Button
Click the **+** button in the top toolbar to open the node picker.

### Method 2: Context Menu
Right-click anywhere on the canvas to open a context menu with node options.

### Method 3: Edge Dragging
Drag from an existing node's output connector (the dot on the right side) to create a new connected node.

## Connecting Nodes

Nodes have connector points:
- **Input** (left side): Receives data from previous nodes
- **Output** (right side): Sends data to subsequent nodes

To connect nodes:
1. Click and hold on a node's output connector
2. Drag to another node's input connector
3. Release to create the connection

Connections show the data flow direction with a curved line between nodes.

## Configuring Nodes

Click any node to open the configuration panel on the right side of the screen.

### Common Configuration Fields

| Field | Description |
|-------|-------------|
| Service | The type of service (Web3, Email, Discord, etc.) |
| Connection | Your configured connection for this service |
| Network | Blockchain network (for Web3 nodes) |
| Address | Wallet or contract address (for Web3 nodes) |
| Label | Display name for this node |
| Description | Optional notes |
| Enabled | Toggle to activate/deactivate this node |

### Trigger Configuration

For trigger nodes, you'll also configure:
- **Schedule**: Interval for scheduled triggers (every 5 minutes, hourly, etc.)
- **Webhook URL**: Provided URL for webhook triggers
- **Event Filter**: Event signature for event triggers

### Condition Configuration

For condition nodes:
- **Input Value**: The value to evaluate (from previous node output)
- **Operator**: Comparison operator (equals, greater than, less than, etc.)
- **Threshold**: The value to compare against

## Managing Connections

Before using certain node types, set up connections in your account:

1. Click your profile icon in the top-right
2. Select **Connections**
3. Add connections for services you need:
   - Web3 wallets
   - Email providers
   - Discord webhooks
   - Slack workspaces

## Enabling and Running

### Enable Individual Nodes
Each node has an **Enabled** toggle in its configuration panel. Disabled nodes are skipped during execution.

### Test Your Workflow
Click the green **Run** button to execute the workflow immediately. This is useful for testing before enabling scheduled execution.

### Delete Nodes
Click **Delete** in the node configuration panel to remove a node and its connections.

## Saving Workflows

- Workflows automatically save when you make changes
- Use the **Save** button to force-save current state
- Invalid configurations prevent saving until fixed

## Using AI to Create Workflows

The **Ask AI...** input at the bottom of the canvas lets you describe your automation in natural language:

1. Click the input field or use the keyboard shortcut
2. Describe what you want to automate
3. The AI will suggest nodes and configurations
4. Review and adjust the generated workflow

### Example Prompts

- "Alert me on Discord when my wallet balance drops below 0.1 ETH"
- "Every hour, check if a contract's totalSupply changed and email me"
- "When someone sends ETH to my wallet, log it to Slack"

## Importing from the Hub

The **Hub** lists workflow templates shared by the community. To use a template:

1. Browse the Hub from the main navigation
2. Select a workflow template
3. Click **Duplicate** to copy it into your workspace

The copy is created with a unique name (e.g., "My Workflow (Copy)") and set to private visibility. Node configurations are preserved, but integration credentials are removed so you can assign your own connections.

You can also duplicate any public workflow you are viewing by clicking the **Duplicate** button in the toolbar.

## Workflow States

| State | Description |
|-------|-------------|
| Draft | Workflow is being edited, not running |
| Active | Workflow is enabled and will execute on triggers |
| Paused | Workflow exists but all triggers are disabled |

## Best Practices

1. **Test on Sepolia first**: Use the testnet before deploying to Mainnet
2. **Name your nodes clearly**: Use descriptive labels for easy understanding
3. **Start simple**: Begin with one trigger and one action, then add complexity
4. **Check your connections**: Ensure all required connections are configured before enabling
5. **Review the Run output**: Check execution logs after running to verify behavior
