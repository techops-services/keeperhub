---
title: "Claude Code Plugin"
description: "Build and manage KeeperHub workflows directly from Claude Code with skills, commands, and MCP tools."
---

# Claude Code Plugin

[GitHub](https://github.com/techops-services/claude-plugins/tree/main/plugins/keeperhub)

The KeeperHub plugin for Claude Code lets you create workflows, browse templates, debug executions, and explore plugins without leaving your terminal.

## Installation

```bash
# Add the marketplace
/plugin marketplace add techops-services/claude-plugins

# Install the plugin
/plugin install keeperhub@techops-plugins

# Run setup (creates API key config, installs MCP server)
/keeperhub:login
```

Restart Claude Code after setup for MCP tools to become available.

### Requirements

- KeeperHub account at [app.keeperhub.com](https://app.keeperhub.com)
- Node.js 20+
- curl

## Commands

### `/keeperhub:login`

One-time setup. Guides you through creating an organization API key, saves it to `~/.claude/keeperhub/config.json`, and auto-installs the MCP server.

The key must be organization-scoped (prefix `kh_`). User-scoped keys (`wfb_`) are not supported.

### `/keeperhub:status`

Check authentication status, API connectivity, and MCP server availability.

```
KeeperHub Status
----------------
Auth:       Authenticated
Key source: config file
API:        Connected
MCP server: Installed
Base URL:   https://app.keeperhub.com
Config:     ~/.claude/keeperhub/config.json
```

## Skills

Skills activate automatically based on what you ask Claude to do. No slash commands needed -- just describe what you want.

### workflow-builder

**Activates when you say:** "create a workflow", "monitor my wallet", "set up automation", "when X happens do Y", "alert me when..."

Walks through building a workflow step by step:
1. Identifies the trigger (what starts it)
2. Discovers available actions via `list_action_schemas`
3. Adds actions one at a time with your input
4. Creates the workflow and offers to test it

**Example prompts:**
- "Create a workflow that checks my vault health every 15 minutes and sends a Telegram alert if collateral drops below 150%"
- "Monitor 0xABC... for large transfers and notify Discord"
- "Set up a weekly reward distribution to stakers"

### template-browser

**Activates when you say:** "show me templates", "find a workflow for...", "deploy a template", "what pre-built workflows exist"

Searches the template library, shows details, and deploys templates to your account with optional customization.

### execution-monitor

**Activates when you say:** "why did my workflow fail", "check execution status", "run my workflow", "show logs"

Triggers workflows, polls for completion, and debugs failures by analyzing execution logs. Identifies the failing step, explains the error, and offers to fix the workflow.

### plugin-explorer

**Activates when you say:** "what plugins are available", "how do I use web3", "show integrations", "what actions can I use"

Lists available plugins and their actions, shows configured integrations, and validates plugin configurations.

## Configuration

Stored at `~/.claude/keeperhub/config.json` (permissions 600):

```json
{
  "apiKey": "kh_...",
  "baseUrl": "https://app.keeperhub.com",
  "mcpDir": "~/.claude/keeperhub/mcp-server"
}
```

Environment variables override the config file:

| Variable | Description |
|----------|-------------|
| `KEEPERHUB_API_KEY` | API key (overrides config file) |
| `KEEPERHUB_API_URL` | Base URL (default: `https://app.keeperhub.com`) |
| `KEEPERHUB_MCP_DIR` | MCP server directory |

## Security

- API keys are saved with file permissions 600 (owner read/write only)
- Keys are never echoed, logged, or displayed after saving
- Keys are masked as `kh_***` in status output
- All API communication is over HTTPS
