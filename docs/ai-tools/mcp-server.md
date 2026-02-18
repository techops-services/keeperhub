---
title: "MCP Server"
description: "Model Context Protocol server for AI agents to build and manage KeeperHub workflows programmatically."
---

# MCP Server

[GitHub](https://github.com/techops-services/keeperhub-mcp)

The KeeperHub MCP server exposes 19 tools over the Model Context Protocol, enabling AI agents to create, execute, and monitor blockchain automation workflows.

## Installation

### Docker (recommended)

```bash
docker build -t keeperhub-mcp .
docker run -i --rm -e KEEPERHUB_API_KEY=kh_your_key keeperhub-mcp
```

### Node.js

```bash
pnpm install
pnpm build
KEEPERHUB_API_KEY=kh_your_key pnpm start
```

### Via Claude Code Plugin

If you installed the [Claude Code Plugin](/ai-tools/claude-code-plugin), the MCP server is auto-installed at `~/.claude/keeperhub/mcp-server`. No manual setup needed.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KEEPERHUB_API_KEY` | Yes | -- | Organization API key (prefix `kh_`) |
| `KEEPERHUB_API_URL` | No | `https://app.keeperhub.com` | API base URL |
| `PORT` | No | -- | Set to enable HTTP/SSE mode (leave unset for stdio) |
| `MCP_API_KEY` | No | -- | Required if PORT is set; authenticates MCP requests |

### Transport Modes

**Stdio (default)** -- For local MCP clients like Claude Code. Uses stdin/stdout.

**HTTP/SSE** -- For remote AI agents. Set `PORT` and `MCP_API_KEY`. All requests require `Authorization: Bearer <MCP_API_KEY>`.

### MCP Client Configuration

**Claude Code (stdio):**
```json
{
  "mcpServers": {
    "keeperhub": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "KEEPERHUB_API_KEY", "keeperhub-mcp"],
      "env": {
        "KEEPERHUB_API_KEY": "kh_your_key_here"
      }
    }
  }
}
```

**Claude Code (local development):**
```json
{
  "mcpServers": {
    "keeperhub": {
      "command": "node",
      "args": ["/path/to/keeperhub-mcp/dist/index.js"],
      "env": {
        "KEEPERHUB_API_KEY": "kh_your_key_here"
      }
    }
  }
}
```

## Tools Reference

### Workflow Management

| Tool | Description |
|------|-------------|
| `list_workflows` | List all workflows in the organization. Accepts `limit` and `offset` for pagination. |
| `get_workflow` | Get full workflow configuration by ID including nodes and edges. |
| `create_workflow` | Create a workflow with explicit nodes and edges. Call `list_action_schemas` first to get valid action types. |
| `update_workflow` | Update a workflow's name, description, nodes, or edges. |
| `delete_workflow` | Permanently delete a workflow and stop all its executions. |

### Execution

| Tool | Description |
|------|-------------|
| `execute_workflow` | Manually trigger a workflow. Returns an execution ID for status polling. |
| `get_execution_status` | Check whether an execution is pending, running, completed, or failed. |
| `get_execution_logs` | Get detailed logs including transaction hashes, API responses, and errors. |

### AI Generation

| Tool | Description |
|------|-------------|
| `ai_generate_workflow` | Generate a workflow from a natural language prompt. Optionally modifies an existing workflow. |

### Action Schemas

| Tool | Description |
|------|-------------|
| `list_action_schemas` | List available action types and their configuration fields. Filter by category: `web3`, `discord`, `sendgrid`, `webhook`, `system`. |

### Plugins

| Tool | Description |
|------|-------------|
| `search_plugins` | Search plugins by name or category (`web3`, `messaging`, `integration`, `notification`). |
| `get_plugin` | Get full plugin documentation with optional examples and config field details. |
| `validate_plugin_config` | Validate an action configuration against its schema. Returns errors and suggestions. |

### Templates

| Tool | Description |
|------|-------------|
| `search_templates` | Search pre-built workflow templates by query, category, or difficulty. |
| `get_template` | Get template metadata and setup guide. |
| `deploy_template` | Deploy a template to your account with optional node customizations. |

### Integrations

| Tool | Description |
|------|-------------|
| `list_integrations` | List configured integrations. Filter by type (`web3`, `discord`, `sendgrid`, etc.). |
| `get_wallet_integration` | Get the wallet integration ID needed for write operations (transfers, contract calls). |

### Documentation

| Tool | Description |
|------|-------------|
| `tools_documentation` | Get documentation for any MCP tool. Use without arguments for a full tool list. |

## Resources

The server exposes two MCP resources:

| URI | Description |
|-----|-------------|
| `keeperhub://workflows` | List of all workflows |
| `keeperhub://workflows/{id}` | Full workflow configuration |

## Creating a Workflow

A typical workflow creation flow:

1. **Discover actions** -- call `list_action_schemas` with a category to see available action types and their required fields
2. **Build nodes** -- construct trigger and action nodes with the correct `actionType` values
3. **Connect nodes** -- define edges from trigger to actions in execution order
4. **Create** -- call `create_workflow` with nodes and edges (auto-layouts positions)
5. **Test** -- call `execute_workflow` and poll `get_execution_status`

### Node Structure

```json
{
  "id": "check-balance",
  "type": "action",
  "data": {
    "label": "Check Balance",
    "description": "Check wallet ETH balance",
    "type": "action",
    "config": {
      "actionType": "web3/check-balance",
      "network": "11155111",
      "address": "0x..."
    },
    "status": "idle"
  }
}
```

Trigger nodes use `type: "trigger"` with a `triggerType` in the config (`Manual`, `Schedule`, `Webhook`, `Event`).

### Condition Nodes

Conditions act as gates, not branches. A condition evaluates to true or false -- if false, execution stops at that node. For if/else logic, use two condition nodes with opposite expressions.

Conditions reference previous node outputs using template syntax: `{{@nodeId:Label.field}}`.

## Web3 Action Reference

### Read Actions (no wallet required)

| Action | Required Fields |
|--------|----------------|
| `web3/check-balance` | `network`, `address` |
| `web3/check-token-balance` | `network`, `address`, `tokenAddress` |
| `web3/read-contract` | `network`, `contractAddress`, `functionName` |

### Write Actions (require wallet integration)

| Action | Required Fields |
|--------|----------------|
| `web3/transfer-funds` | `network`, `toAddress`, `amount`, `walletId` |
| `web3/transfer-token` | `network`, `toAddress`, `tokenAddress`, `amount`, `walletId` |
| `web3/write-contract` | `network`, `contractAddress`, `functionName`, `walletId` |

Get the `walletId` by calling `get_wallet_integration`.

The `network` field accepts chain IDs as strings: `"1"` (Ethereum mainnet), `"11155111"` (Sepolia), `"8453"` (Base), `"42161"` (Arbitrum), `"137"` (Polygon).

## HTTP Endpoints

When running in HTTP/SSE mode (PORT is set):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Optional | Health check |
| GET | `/sse` | Required | Establish SSE connection |
| POST | `/message?sessionId=...` | Required | Send MCP message |

## Error Handling

All tools return errors in this format:

```json
{
  "content": [{ "type": "text", "text": "Error: <message>" }],
  "isError": true
}
```

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing API key |
| 404 | Workflow or execution not found |
| 400 | Invalid parameters |
| 500 | Server error |
