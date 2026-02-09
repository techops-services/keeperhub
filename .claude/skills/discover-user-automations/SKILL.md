---
name: discover-user-automations
description: Suggest user-facing KeeperHub workflow automations for a DeFi protocol
argument-hint: <protocol_name> [chain]
---

# Discover User Automations Skill

Suggest user-facing workflow automations for a DeFi protocol using KeeperHub's capabilities. This covers monitoring, alerts, automated DeFi actions, scheduled tasks, and event-driven workflows that end users would set up.

## Usage

```
/discover-user-automations <protocol_name> [chain]
```

Examples:
- `/discover-user-automations Aave` - Suggest user automations for Aave
- `/discover-user-automations Uniswap ethereum` - Suggest user automations for Uniswap on Ethereum

## Instructions

<discover-user-automations>

You are a KeeperHub automation expert. Your job is to research a DeFi protocol's user-facing features and suggest practical workflow automations that KeeperHub can build.

### Step 1: Fetch KeeperHub Capabilities

Fetch the current capabilities:

```
mcp__keeperhub__list_action_schemas (no params for summary)
mcp__keeperhub__list_action_schemas with category: "web3" (for full web3 schema)
```

This gives you the up-to-date list of:
- **Triggers**: What can start a workflow (Schedule, Webhook, Event/blockchain events)
- **Actions**: What workflows can do (read-contract, write-contract, check-balance, transfers, notifications)

Store this as the "capability set" for feasibility checks.

### Step 2: Research Protocol User Features

Use `WebSearch` to find protocol information:
- `"<protocol> documentation"`
- `"<protocol> smart contracts addresses"`
- `"<protocol> developer docs API"`

If a specific chain was provided:
- `"<protocol> <chain> contracts"`

Use `WebFetch` on the top 2-4 most relevant results to extract:
- **Protocol overview**: What it does, category (Lending, DEX, Liquid Staking, Yield, etc.)
- **Key contracts**: Names, addresses, and roles of the most important contracts (top 3-5)
- **Core user actions**: What users do (supply, borrow, swap, stake, claim, etc.)
- **Key events**: Important on-chain events emitted by the contracts
- **Chains deployed on**: Which networks the protocol is live on
- **Key read functions**: View functions users check (balances, positions, rates, health factors)

### Step 3: Map Features to KeeperHub Capabilities

For each protocol feature or user action:
- Can it be **read** via `read-contract`?
- Can it be **executed** via `write-contract`?
- Can it be **monitored** via Event trigger listening for specific events?
- Can balances be **tracked** via `check-balance`?
- Can it be triggered on a **schedule** or via **webhook**?

Track which features map and which do not map to any capability.

### Step 4: Generate Automation Suggestions

Group suggestions by category. For each suggestion:

```
### [Suggestion Name]

**Trigger**: [Schedule | Webhook | Event]
**What it does**: [1-2 sentence description]

**Workflow nodes**:
1. [Trigger type] - [configuration]
2. [Action] - [what it does]
3. [Optional: Condition] - [if applicable]
4. [Notification/Action] - [final step]

**Use case**: [Why someone would want this]
**Complexity**: [Low | Medium | High]
```

Categories:
1. **Monitoring & Alerts** - Track state changes, balances, health factors, positions
2. **Automated Actions** - Auto-claim, auto-compound, auto-rebalance, auto-repay
3. **Scheduled Tasks** - Periodic snapshots, health checks, portfolio reporting
4. **Event-Driven Workflows** - React to on-chain events (large swaps, liquidations, governance votes)

### Step 5: Produce Output

```markdown
# User Automations: [Protocol Name]

**Category**: [Lending / DEX / Liquid Staking / Yield / etc.]
**Chains**: [Deployed networks]
**Key Contracts**: [Top 3-5 with addresses and roles]

## Protocol Overview
[1-2 paragraphs on what users do with this protocol]

## Automation Suggestions

### Monitoring & Alerts
[Suggestions]

### Automated Actions
[Suggestions]

### Scheduled Tasks
[Suggestions]

### Event-Driven Workflows
[Suggestions]

## Feature Gaps

[Features users would want automated but KeeperHub can't do today]

| Feature | What's Needed | Why KeeperHub Can't Do It | Priority |
|---------|---------------|---------------------------|----------|
| ... | ... | ... | ... |

## Quick Start
[Pick the simplest high-value automation and describe exactly how to create it with KeeperHub, including contract addresses and function names]
```

### Edge Cases

- **Protocol not found**: Suggest using `/analyse-contract` with specific contract addresses instead.
- **Many contracts**: Focus on top 3-5 most important contracts.
- **Unsupported chain**: Note as a gap.

### Important Notes

- Only suggest automations KeeperHub can ACTUALLY do (based on Step 1 capabilities)
- Be specific about which KeeperHub action types to use
- Include actual contract addresses and function names
- For write operations, remind users they need a wallet integration
- Do not invent contract addresses

</discover-user-automations>
