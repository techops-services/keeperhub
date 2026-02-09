---
name: analyse-protocols
description: Research a DeFi protocol and suggest KeeperHub workflow automations with gap analysis
argument-hint: <protocol_name> [chain]
---

# Analyse Protocols Skill

Full analysis of a DeFi protocol: discovers existing keeper infrastructure, suggests user automations, and produces a gap analysis. This skill orchestrates `/discover-keepers` and `/discover-user-automations` as sub-skills.

## Usage

```
/analyse-protocols <protocol_name> [chain]
```

Examples:
- `/analyse-protocols Aave` - Full analysis of Aave across all chains
- `/analyse-protocols Uniswap ethereum` - Full analysis of Uniswap on Ethereum
- `/analyse-protocols Lido arbitrum` - Full analysis of Lido on Arbitrum

## Instructions

<analyse-protocols>

You are a KeeperHub automation expert. Your job is to produce a comprehensive protocol analysis by orchestrating two sub-skills and combining their results with a gap analysis.

### Execution Order

You MUST execute these steps in this exact order. Do NOT skip or combine steps.

### Step 1: Run Keeper Discovery (HIGHEST PRIORITY)

Invoke the discover-keepers sub-skill FIRST. This is the most important part of the analysis.

Use the Skill tool:
```
/discover-keepers <protocol_name> [chain]
```

Wait for the keeper discovery to complete fully before proceeding. Store the results -- you will need them for the combined output and gap analysis.

### Step 2: Run User Automations

After keeper discovery completes, invoke the discover-user-automations sub-skill.

Use the Skill tool:
```
/discover-user-automations <protocol_name> [chain]
```

Wait for user automations to complete fully. Store the results.

### Step 3: Generate Gap Analysis

Now combine insights from BOTH sub-skills to produce a comprehensive gap analysis. Compare what the protocol needs (from both keeper operations AND user automations) against KeeperHub's capabilities.

Identify:

**Missing Actions**: Protocol features that need action types KeeperHub doesn't have
- Example: "Swap tokens" requires a DEX aggregator action
- Example: "Flash loan liquidation" requires atomic multi-step transactions

**Missing Triggers**: Events or conditions KeeperHub can't currently trigger on
- Example: Mempool monitoring, cross-chain events, price oracle thresholds

**Missing Integrations**: External services the protocol relies on
- Example: Protocol-specific APIs, subgraph queries, off-chain data feeds

**Architectural Gaps**: Patterns the protocol needs that KeeperHub doesn't support
- Example: Atomic multi-step transactions, flash loans, gas optimization, MEV protection

For each gap, document:
- What the protocol needs
- Why KeeperHub can't do it today
- What would need to be built
- Priority (High / Medium / Low) based on impact
- Whether this blocks a keeper operation (High) or user automation (Medium/Low)

### Step 4: Produce Combined Output

Combine results from both sub-skills and the gap analysis into a single report. Save it to `keeperhub/analysis/<protocol>-<chain>-analysis.md` (or `keeperhub/analysis/<protocol>-analysis.md` if no chain specified).

Use this exact output format:

```markdown
# Protocol Analysis: [Name]

**Category**: [Lending / DEX / Liquid Staking / Yield / Derivatives / etc.]
**Chains**: [Deployed networks]
**Key Contracts**: [Top 3-5 with addresses and roles]
**Documentation**: [Link to official docs]

## Protocol Overview
[2-3 paragraphs explaining what the protocol does, how it works, and why it matters]

---

## Part 1: Keeper Infrastructure (Operational Automations)

[Insert full output from /discover-keepers here]

---

## Part 2: User Automations

[Insert full output from /discover-user-automations here, excluding the protocol overview section since it's already above]

---

## Part 3: Gap Analysis

### Actions KeeperHub Should Build

| Priority | Gap | What Protocol Needs | Source | Suggested Feature |
|----------|-----|---------------------|--------|-------------------|
| High | ... | ... | Keeper / User | ... |
| ... | ... | ... | ... | ... |

### Missing Triggers & Integrations

| Priority | Gap | Current Limitation | Source | Recommendation |
|----------|-----|-------------------|--------|----------------|
| ... | ... | ... | Keeper / User | ... |

### Platform Improvements

| Priority | Gap | Current Limitation | Source | Recommendation |
|----------|-----|-------------------|--------|----------------|
| ... | ... | ... | Keeper / User | ... |

### Priority Recommendations
1. **High**: [Gaps that block keeper operations -- these unlock the most value]
2. **Medium**: [Gaps that block high-value user automations]
3. **Low**: [Nice-to-have improvements for user automations]

## Quick Start
[Pick the single highest-value automation (prefer a keeper operation if feasible) and describe exactly how to create it with KeeperHub, including specific contract addresses, function names, and ABI details from the research]
```

### Important Notes

- The keeper discovery sub-skill MUST run first and complete before user automations
- If keeper discovery finds keepers that overlap with user automation suggestions, note the overlap but keep both perspectives
- The gap analysis MUST clearly label whether each gap blocks a keeper operation or user automation
- Gaps that block keeper operations are ALWAYS higher priority than gaps that block user automations
- Always save the output to `keeperhub/analysis/`
- Do not invent contract addresses or keeper repos

</analyse-protocols>
