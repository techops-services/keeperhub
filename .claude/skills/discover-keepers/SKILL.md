---
name: discover-keepers
description: Discover existing keeper/bot automation infrastructure within a DeFi protocol
argument-hint: <protocol_name> [chain]
---

# Discover Keepers Skill

Discover existing keeper, bot, and automation infrastructure within a DeFi protocol. This finds the operational maintenance layer -- the automated tasks that keep a protocol functioning (oracle updates, liquidations, auction management, fee accrual, governance execution).

These represent the highest-value automation opportunities for KeeperHub because they are essential, recurring, and often poorly tooled.

## Usage

```
/discover-keepers <protocol_name> [chain]
```

Examples:
- `/discover-keepers Sky` - Find all keeper infrastructure in Sky/MakerDAO
- `/discover-keepers Aave ethereum` - Find Aave keepers on Ethereum
- `/discover-keepers Compound` - Find Compound keeper bots

## Instructions

<discover-keepers>

You are a KeeperHub keeper infrastructure researcher. Your job is to exhaustively find every keeper, bot, and automated maintenance process that exists within a DeFi protocol. This is the most critical part of protocol analysis because these operational tasks are exactly what KeeperHub automates.

### Step 1: Fetch KeeperHub Capabilities

Fetch the current web3 capabilities so you know what KeeperHub can run:

```
mcp__keeperhub__list_action_schemas with category: "web3"
```

Store this as the capability set for feasibility assessment. The key pattern for keepers is: Schedule trigger -> `read-contract` (check if work needed) -> Condition -> `write-contract` (do the work). Most simple keepers fit this pattern.

### Step 2: Research Protocol Context and Find the Registry

This step has TWO goals: basic protocol context AND finding the contract registry. The registry is the single most valuable source for keeper discovery -- it reveals every deployed contract including keeper-specific ones.

Use `WebSearch`:
- `"<protocol> documentation"`
- `"<protocol> smart contracts addresses [chain]"`
- `"<protocol> contract registry"` or `"<protocol> chainlog"` or `"<protocol> deployment addresses"`

Use `WebFetch` on the top 1-2 results to understand:
- What the protocol does (Lending, DEX, Stablecoin, etc.)
- The protocol's GitHub organization name (check both current AND previous names -- many protocols rebrand, e.g., MakerDAO -> Sky)
- Whether it has a contract registry, chainlog, or address book API

**CRITICAL**: If the protocol has a registry/chainlog/address-book, fetch it NOW with `WebFetch`. This is your most important data source. Look for:
- JSON API endpoints (e.g., `chainlog.sky.money/api/mainnet/active.json`, `bgd-labs/aave-address-book`)
- Deployment addresses pages in docs
- GitHub repos named `*-addresses`, `*-deployments`, `*-address-book`

When scanning the registry, look for contract names containing ANY of these keywords:
`KEEPER`, `POKER`, `POKE`, `CRON`, `JOB`, `SEQUENCER`, `AUTOMATION`, `BOT`, `EXEC`, `MOM`, `FLAP`, `FLOP`, `CLIP`, `CLIPPER`, `LERP`, `VEST`, `DOG`, `CURE`, `END`, `ESM`, `BLOW`, `KICK`, `AUTO`, `LINE`, `GUARD`, `REWARDS`, `DIST`, `PSM`, `D3M`, `DIRECT`

These contract names reveal:
- **CRON/JOB/SEQUENCER**: Centralized job scheduling system (very common in mature protocols)
- **MOM**: Guardian/circuit-breaker contracts (emergency keeper targets)
- **FLAP/FLOP/CLIP**: Auction contracts (need keepers to trigger and participate)
- **VEST/REWARDS/DIST**: Reward distribution (need keepers to trigger payouts)
- **AUTO/LINE**: Auto-adjusting parameters (need keepers to execute adjustments)
- **DOG/KICK/BARK**: Liquidation infrastructure (need keepers to trigger)

### Step 3: Search for Keeper Repositories on GitHub

Search GitHub exhaustively for keeper-related repos. Run ALL of these searches in parallel:
- `"<protocol> keeper" site:github.com`
- `"<protocol-org> keeper" site:github.com` (use the org name from Step 2)
- `"<protocol> bot" site:github.com`
- `"<protocol> automation" site:github.com`
- `"<protocol> cron" OR "<protocol> sequencer" OR "<protocol> job" site:github.com`

If the protocol was rebranded, search BOTH names (e.g., both `makerdao` and `sky-ecosystem`).

Also browse the protocol's GitHub org page directly:
- `https://github.com/orgs/<org-name>/repositories` -- scan repo names for keeper-related patterns

Common keeper repo naming patterns to look for:
- `*-keeper` (auction-keeper, chief-keeper, liquidation-keeper, cage-keeper, bite-keeper)
- `*-bot` (liquidation-bot, arbitrage-bot)
- `*-automation` or `*-autotask`
- `megapoker`, `omegapoker`, `pokerkeeper` (oracle poker contracts)
- `*-relayer`, `*-executor`, `*-sequencer`
- `dss-cron`, `*-cron`, `*-jobs` (cron/job systems)
- `pymaker`, `*-api`, `keeper-framework` (keeper libraries/frameworks)
- `developerguides/keepers` (documentation repos with keeper guides)

For each keeper repo found, use `WebFetch` on the repo README to extract:
- What maintenance function(s) it calls (e.g., `poke()`, `bark()`, `work()`)
- Which contract(s) it targets (with addresses if available)
- How frequently it runs (every block, every N minutes, on-demand)
- Whether it's actively maintained or archived/deprecated
- Configuration details / required parameters
- Capital requirements (does it need tokens, gas, etc.)

### Step 4: Search for Keeper Developer Documentation

Many protocols have dedicated keeper documentation sections. Search for these explicitly:
- `"<protocol> keeper documentation"`
- `"<protocol> keeper guide" OR "<protocol> keeper setup"`
- `site:docs.<protocol>.com keepers` or `site:developer.<protocol>.com keepers`
- `"<protocol> developer guides keepers" site:github.com`

Also search for governance proposals about keeper networks -- these reveal what keeper infrastructure exists, who operates it, and how it's funded:
- `"<protocol> keeper network" governance proposal`
- `"<protocol> keeper onboarding"`
- `site:forum.<protocol>.com keeper` or `site:forum.<protocol>.money keeper`

### Step 5: Identify the Job/Cron System Pattern

Many mature DeFi protocols use a centralized job scheduling system where:
1. A **Sequencer** or **Registry** contract holds an array of registered jobs
2. Each **Job** contract implements an interface like `IJob` with:
   - `workable()` -- returns true if the job needs execution
   - `work()` -- executes the job
3. **Keeper Networks** (Chainlink, Gelato, Keep3r, TechOps, etc.) poll the Sequencer for available work

If you found CRON/JOB/SEQUENCER contracts in the registry (Step 2), this pattern likely exists. Search for:
- The Sequencer contract and its registered jobs
- The IJob interface or equivalent
- Which Keeper Networks are registered to execute jobs
- How keeper networks are funded (usually via vesting/streaming contracts)

This pattern is the HIGHEST VALUE discovery because each job in the Sequencer is a distinct automation that KeeperHub can potentially run with the standard pattern:
`Schedule (every 5 min) -> read-contract workable() -> Condition (if true) -> write-contract work()`

### Step 6: Identify Maintenance Functions in Contracts

Search protocol documentation, contract ABIs, and GitHub source code for keeper-callable function patterns. These are functions designed to be called by external bots:

**Oracle updates**: `poke()`, `updatePrice()`, `update()`, `transmit()`, `poke(bytes32)`, `refresh()`
**Fee/interest accrual**: `drip()`, `drip(bytes32)`, `accrue()`, `accrueInterest()`
**Liquidations**: `bark()`, `bark(bytes32,address,address)`, `liquidate()`, `liquidationCall()`, `absorb()`, `bite()`
**Auctions**: `kick()`, `deal()`, `tick()`, `take()`, `redo()`, `clip.take()`, `yank()`
**Governance**: `cast()`, `exec()`, `execute()`, `lift()`, `plot()`, `schedule()`, `vote()`
**Vault/position management**: `heal()`, `cure()`, `tend()`, `dent()`, `cage()`, `skim()`
**Rewards/distribution**: `harvest()`, `distribute()`, `claim()`, `poke()`, `topUp()`
**Queue processing**: `execute()`, `process()`, `relay()`, `finalize()`, `run()`
**Sequencing/multi-target**: `fire()`, `run()`, `exec()`, `poke()` (multi-collateral)
**Parameter adjustment**: `exec()`, `adjust()`, `update()`, `set()`
**Circuit breakers**: `halt()`, `stop()`, `disable()`, `trip()` (on MOM contracts)

Search for these in:
- Protocol developer docs
- Contract ABIs / interfaces on Etherscan
- GitHub source code (especially in `src/` directories)
- The IJob implementations if a cron system was found

### Step 7: Check for Existing Automation Services

Search for known automation services already targeting this protocol:
- `"<protocol> Chainlink Automation"` or `"<protocol> Chainlink Keepers"`
- `"<protocol> Gelato Network"` or `"<protocol> Gelato automate"`
- `"<protocol> OpenZeppelin Defender"`
- `"<protocol> Keep3r Network"` or `"keep3r" "<protocol>" site:github.com`
- `"<protocol> keeper network" budget` or `"<protocol> keeper network" funding` (reveals who's paid to run keepers)

Also search for third-party keeper implementations:
- `"<protocol>" keeper site:github.com -org:<protocol-org>` (repos OUTSIDE the protocol's own org)
- These often reveal community-built keepers that the protocol doesn't officially maintain

### Step 8: Assess KeeperHub Feasibility and Rank

For each keeper found, assess whether KeeperHub can run it AND rank by value:

**Feasible** (KeeperHub can do this today):
- Simple `write-contract` calls on a schedule (e.g., `poke()`, `drip()`) -- HIGHEST VALUE, simplest to implement
- Read a value then conditionally write (e.g., `workable()` -> `work()`) -- HIGH VALUE, standard cron pattern
- Event-triggered actions (e.g., listen for event, then call function) -- MEDIUM VALUE

**Partially feasible** (needs workarounds):
- Multi-contract calls in sequence (chain multiple workflow nodes)
- Conditional logic based on complex on-chain state (multiple reads before write)
- Needs gas price optimization

**Not feasible** (gaps):
- Requires flash loans or atomic multi-step transactions
- Needs MEV protection or private mempools
- Requires off-chain computation (e.g., optimal bid calculation, price modeling)
- Needs cross-chain coordination
- Requires capital management (joining/exiting vaults, managing token balances)

**Ranking priority for the output**:
1. Simple scheduled write-contract keepers (poke, drip, work) -- list these FIRST
2. Read-condition-write pattern keepers (workable -> work) -- list second
3. Event-triggered keepers -- list third
4. Complex keepers requiring new features -- list last
5. Deprecated/not-feasible keepers -- list at the very end

### Step 9: Produce Output

Output the results in this format. IMPORTANT: In the "Immediately Automatable" section, rank keepers by simplicity -- single-function zero-parameter keepers (like MegaPoker's `poke()`) should be listed FIRST because they are the quickest wins.

```markdown
# Keeper Discovery: [Protocol Name]

**Protocol**: [Name] ([Category])
**Chain**: [Chain or "All chains"]
**Protocol Org**: [GitHub org name]
**Registry/Chainlog**: [URL if exists, "None found" otherwise]

## Summary

[1-2 sentences: how many keepers found, what categories they fall into, overall KeeperHub feasibility]

## Keeper Infrastructure

### [Keeper Name 1]
**Contract**: [address if known]
**Repository**: [GitHub URL if found]
**Function**: [what it calls, e.g., poke() on MCD_SPOT]
**Target contracts**: [which protocol contracts it interacts with, with addresses]
**Frequency**: [how often it needs to run - every block, every N minutes, on-demand]
**Current operator**: [who runs it - protocol team, community, Chainlink, Gelato, unknown]
**Status**: [Active / Deprecated / Unknown]
**KeeperHub feasibility**: [Feasible / Partially feasible / Not feasible]
**Implementation notes**: [What KeeperHub nodes would be needed, any caveats]

[Repeat for each keeper]

## Cron/Job System

[If a centralized job system was found (like DssCron Sequencer), document it here with all registered jobs in a table]

| Job | Contract | What It Does | KeeperHub Feasible? |
|-----|----------|-------------|---------------------|
| ... | ... | ... | ... |

## Maintenance Functions Without Known Keepers

[List any keeper-callable functions found in contracts that don't have a known keeper repo or operator. These are potential greenfield opportunities.]

| Function | Contract | Description | KeeperHub Feasible? |
|----------|----------|-------------|---------------------|
| ... | ... | ... | ... |

## Guardian/Circuit Breaker Contracts (MOM)

[If guardian contracts exist, list them. These are emergency keeper targets.]

| Contract | Address | Purpose |
|----------|---------|---------|
| ... | ... | ... |

## External Automation Services

[Document any Chainlink Automation, Gelato, Keep3r, or OpenZeppelin Defender usage found]

| Service | What It Automates | Status | Funding |
|---------|-------------------|--------|---------|
| ... | ... | ... | ... |

## KeeperHub Opportunity Assessment

### Immediately Automatable (ranked by simplicity)
[Keepers that KeeperHub can run TODAY with existing capabilities. List simplest first -- zero-parameter scheduled write-contract calls at the top, then read-condition-write patterns, then event-triggered patterns.]

### Requires New Features
[Keepers that need new KeeperHub capabilities, and what specifically]

### Not Suitable for KeeperHub
[Keepers that don't fit KeeperHub's model, and why]
```

### Edge Cases

- **No keepers found**: State this explicitly. Some protocols don't have public keeper infrastructure (they may run private bots). Suggest checking Etherscan for contracts with high-frequency automated calls from EOAs or known bot contracts. Also check if the protocol uses an upgradeable proxy pattern where keeper functions may be hidden behind a proxy.
- **Deprecated keepers**: Include them but mark as deprecated. They show what the protocol USED to need automated and may indicate successor systems.
- **Multiple chains**: If no chain specified, focus on mainnet first then note other chains.
- **Protocol rebrands**: Search BOTH old and new names (e.g., MakerDAO AND Sky, Fantom AND Sonic). GitHub orgs often get renamed but old links redirect.
- **No registry/chainlog**: Not all protocols have one. Fall back to deployment addresses in docs, GitHub release notes, or governance proposals.
- **Protocols with Keeper Networks**: Some protocols (Sky, Aave) have formal Keeper Networks where multiple operators (Chainlink, Gelato, Keep3r, TechOps) are onboarded via governance. Search governance proposals for "keeper network onboarding" to find all operators and their contracts.

### Important Notes

- Be EXHAUSTIVE. The whole point of this skill is to not miss keepers. When in doubt, search more.
- The contract registry/chainlog is your single best data source. Find it early and scan it thoroughly.
- Search the protocol's old name too if it was rebranded. GitHub orgs rename but repos stay.
- Check the protocol's governance forum for keeper-related discussions and proposals.
- Look for the Sequencer/Cron/Job pattern -- mature protocols almost always have one.
- Governance proposals about keeper budgets reveal who operates keepers and how they're paid.
- Developer documentation often has a dedicated "Keepers" section -- find it.
- Do not invent addresses or keeper repos. Only include verified findings.
- When ranking output, simple zero-parameter scheduled keepers (like `poke()`) are ALWAYS the top opportunity because they require minimal configuration and deliver immediate value.

</discover-keepers>
