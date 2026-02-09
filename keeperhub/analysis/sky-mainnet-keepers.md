# Keeper Discovery: Sky (formerly MakerDAO)

**Protocol**: Sky / MakerDAO (Stablecoin / Lending / Savings)
**Chain**: Ethereum Mainnet (chain ID: `1`)
**Protocol Org**: [sky-ecosystem](https://github.com/sky-ecosystem) (formerly `makerdao`)
**Registry/Chainlog**: [chainlog.sky.money/api/mainnet/active.json](https://chainlog.sky.money/api/mainnet/active.json)

## Summary

Sky has one of the most sophisticated keeper infrastructures in DeFi, with **9 active cron jobs** managed by a centralized Sequencer contract, plus standalone keepers for governance, oracles, and auctions. Four keeper networks (TechOps, Chainlink Automation, Keep3r Network, Gelato) are onboarded via governance and funded through DAI vesting streams. KeeperHub can automate many of the simpler cron jobs today using the standard `Schedule -> read-contract(workable) -> Condition -> write-contract(work)` pattern, while auction participation and oracle updates require more complex infrastructure.

## Keeper Infrastructure

### 1. MegaPoker / OmegaPoker (Oracle Price Updates)

**Contract (MegaPoker)**: `0x727D37B7E185f4d57aEbb66a5e5CBd946Fa87999`
**Contract (OmegaPoker)**: `0xDd538C362dF996727054AC8Fb67ef5394eC9b8b9` (mainnet backup)
**Repository**: [sky-ecosystem/megapoker](https://github.com/makerdao/megapoker)
**Function**: Calls `poke()` on all Oracle Security Modules (OSMs/PIPs) to push price updates, then calls `drip()` on MCD_JUG to accrue stability fees and `poke()` on MCD_SPOT to update collateral price feeds.
**Target contracts**: All PIP_* contracts (PIP_ETH `0x81FE72B5A8d1A857d176C3E7d5Bd2679A9B85763`, PIP_WBTC `0xf185d0682d50819263941e5f4EacC763CC5C6C42`, PIP_WSTETH `0xFe7a2aC0B945f12089aEEB6eCebf4F384D9f043F`, etc.), MCD_JUG `0x19c0976f590D67707E62397C87829d896Dc0f1F1`, MCD_SPOT `0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3`
**Frequency**: Every block or every ~15 minutes (oracle heartbeat)
**Current operator**: TechOps (primary), Keeper Networks (backup via OracleJob)
**Status**: Active
**KeeperHub feasibility**: Partially feasible
**Implementation notes**: MegaPoker has hardcoded addresses and calls poke() on many contracts in a single transaction. OmegaPoker dynamically reads PIPs from ILK_REGISTRY. The OracleJob in dss-cron (`0xe717Ec34b2707fc8c226b34be5eae8482d06ED03`) provides a `workable()/work()` interface for this. KeeperHub could call the OracleJob via the standard cron pattern, but the gas cost and multi-target nature make it complex.

### 2. Chief Keeper (Governance Execution)

**Repository**: [sky-ecosystem/chief-keeper](https://github.com/sky-ecosystem/chief-keeper)
**Function**: Monitors DSChief executive voting, lifts the hat (promotes most-approved spell), calls `DSSSpell.schedule()` to queue proposals, and calls `DSSSpell.cast()` after timelock expires.
**Target contracts**: MCD_ADM (DSChief) `0x929d9A1435662357F54AdcF64DcEE4d6b867a6f9`, MCD_PAUSE `0xbE286431454714F511008713973d3B053A2d38f3`
**Frequency**: Continuous monitoring, acts on governance events
**Current operator**: TechOps / community operators
**Status**: Active (162 commits)
**KeeperHub feasibility**: Partially feasible
**Implementation notes**: Requires continuous block monitoring and maintaining local state (spell addresses and their scheduled execution times). The `schedule()` and `cast()` calls are straightforward write-contract calls, but detecting when to call them requires tracking vote states across blocks. Could potentially use a schedule trigger to periodically check if any spell needs scheduling/casting.

### 3. Auction Keeper (Liquidation Participation)

**Repository**: [sky-ecosystem/auction-keeper](https://github.com/makerdao/auction-keeper) (archived)
**Function**: Participates in clip (collateral sale), flap (MKR buy-and-burn), and flop (MKR minting) auctions by calling `take()`, `deal()`, `redo()` on Clipper contracts.
**Target contracts**: All MCD_CLIP_* contracts, MCD_FLAP `0x374D9c3d5134052Bc558F432Afa1Df6575f07407`, MCD_FLOP `0xA41B6EF151E06da0e34B009B86E828308986736D`
**Frequency**: Event-triggered (listens for auction start events)
**Current operator**: Community operators, MEV searchers
**Status**: Repository archived Oct 2024, but auction participation remains active
**KeeperHub feasibility**: Not feasible
**Implementation notes**: Requires bidding models, capital for purchasing collateral, MEV protection, flash loan integration for capital-efficient participation, and complex multi-step atomic transactions. The `auction-demo-keeper` was also archived without reaching production readiness.

### 4. Cage Keeper (Emergency Shutdown)

**Repository**: [sky-ecosystem/cage-keeper](https://github.com/makerdao/cage-keeper)
**Function**: Facilitates Emergency Shutdown by interacting with MCD_END `0x0e2e8F1D1326A4B9633D96222Ce399c708B19c28`, MCD_FLOP, and MCD_FLAP contracts. Processes under-collateralized vaults during shutdown.
**Target contracts**: MCD_END `0x0e2e8F1D1326A4B9633D96222Ce399c708B19c28`, MCD_ESM `0x09e05fF6142F2f9de8B6B65855A1d56B6cfE4c58`
**Frequency**: On-demand (only during emergency shutdown)
**Current operator**: TechOps / community
**Status**: Active (rarely needed)
**KeeperHub feasibility**: Partially feasible
**Implementation notes**: Emergency shutdown is rare. The functions are simple write-contract calls, but the sequencing and timing are critical. Could set up monitoring for ESM activation events as a trigger.

### 5. Maker Keeper (Debt Ceiling Auto-Line)

**Repository**: [sky-ecosystem/maker-keeper](https://github.com/sky-ecosystem/maker-keeper)
**Function**: On each block, checks if there's any debt ceiling change opportunity via `AutoLineJob.getNextJob()` and executes the transaction to update. Calls `exec()` on MCD_IAM_AUTO_LINE.
**Target contracts**: MCD_IAM_AUTO_LINE `0xC7Bdd1F2B16447dcf3dE045C4a039A60EC2f0ba3`, CRON_AUTOLINE_JOB `0x67AD4000e73579B9725eE3A149F85C4Af0A61361`
**Frequency**: Every block (checks for opportunities)
**Current operator**: TechOps, Keeper Networks
**Status**: Active (52 commits)
**KeeperHub feasibility**: Feasible
**Implementation notes**: Classic `workable() -> work()` pattern via the AutoLineJob cron contract. Parameters: thi=1000 bps, tlo=5000 bps. KeeperHub workflow: Schedule (every 1 min) -> read-contract `workable()` on CRON_AUTOLINE_JOB -> Condition (if true) -> write-contract `work()`.

## Cron/Job System (dss-cron)

Sky uses a centralized job scheduling system called **dss-cron** with a **Sequencer** contract at the core.

**Sequencer Contract**: `0x238b4E35dAed6100C6162fAE4510261f88996EC9`
**Repository**: [sky-ecosystem/dss-cron](https://github.com/makerdao/dss-cron)

### How It Works

1. The Sequencer maintains an `activeJobs` array of registered job contracts
2. Each job implements the `IJob` interface with `workable()` and `work()` functions
3. Keeper Networks poll the Sequencer for available work via `getNextJobs()`
4. When `workable()` returns true, the keeper calls `work()` to execute the job
5. Three adapter contracts handle compensation for different keeper networks (Gelato, Keep3r, Chainlink)

### Registered Cron Jobs

| Job | Contract | What It Does | Parameters | KeeperHub Feasible? |
|-----|----------|-------------|------------|---------------------|
| AutoLineJob | `0x67AD4000e73579B9725eE3A149F85C4Af0A61361` | Adjusts debt ceilings when utilization hits thresholds | thi=1000 bps, tlo=5000 bps | Yes |
| LerpJob | `0x8F8f2FC1F0380B9Ff4fE5c3142d0811aC89E32fB` | Executes linear interpolation of parameters over time | max 1 day TTL | Yes |
| D3MJob | `0x2Ea4aDE144485895B923466B4521F5ebC03a0AeF` | Manages Direct Deposit Modules (Aave, Spark, Compound) | threshold=500 bps, ttl=10 min | Yes |
| ClipperMomJob | `0x7E93C4f61C8E8874e7366cDbfeFF934Ed089f9fF` | Governance-triggered liquidation circuit breaker | On-demand | Yes |
| OracleJob | `0xe717Ec34b2707fc8c226b34be5eae8482d06ED03` | Triggers oracle price updates (poke) | Per-oracle cadence | Partially (high gas) |
| LitePsmJob | `0x0C86162ba3E507592fC8282b07cF18c7F902C401` | PSM bookkeeping: fill(), trim(), chug() on LitePSM | Continuous | Yes |
| FlapJob | `0xE564C4E237f4D7e0130FdFf6ecC8a5E931C51494` | Triggers Smart Burn Engine surplus auctions | maxGasPrice=138 gwei | Yes |
| RewardsDistJob | `0x6464C34A02DD155dd0c630CE233DD6e21C24F9A5` | Distributes vested rewards (SKY, SPK tokens) | interval=7 days | Yes |
| StarGuardJob | `0xB18d211fA69422a9A848B790C5B4a3957F7Aa44E` | Stability monitoring for Star Agent modules | Unknown | Yes |

All jobs follow the `workable() -> work()` pattern and can be automated with the standard KeeperHub cron workflow:
`Schedule trigger (every N minutes) -> read-contract workable(network, sequencer) -> Condition -> write-contract work(network, sequencer)`

## Maintenance Functions Without Known Keepers

These are keeper-callable functions found in contracts that don't have dedicated keeper repos but may be called by the cron system or directly by TechOps.

| Function | Contract | Address | Description | KeeperHub Feasible? |
|----------|----------|---------|-------------|---------------------|
| `drip(bytes32 ilk)` | MCD_JUG | `0x19c0976f590D67707E62397C87829d896Dc0f1F1` | Accrue stability fees for a collateral type | Yes (simple write) |
| `drip()` | MCD_POT | `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7` | Accrue DSR savings yield | Yes (simple write) |
| `poke(bytes32 ilk)` | MCD_SPOT | `0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3` | Update collateral price from oracle | Yes (simple write) |
| `bark(bytes32,address,address)` | MCD_DOG | `0x135954d155898D42C90D2a57824C690e0c7BEf1B` | Trigger vault liquidation | Partially (needs monitoring) |
| `heal(uint256)` | MCD_VOW | `0xA950524441892A31ebddF91d3cEEFa04Bf454466` | Settle system surplus/debt | Yes (simple write) |
| `exec(bytes32)` | MCD_IAM_AUTO_LINE | `0xC7Bdd1F2B16447dcf3dE045C4a039A60EC2f0ba3` | Execute debt ceiling adjustment | Yes (via AutoLineJob) |
| `fill()` / `trim()` / `chug()` | MCD_LITE_PSM_USDC_A | `0xf6e72Db5454dd049d0788e411b06CfAF16853042` | PSM bookkeeping (mint DAI, burn excess, send fees) | Yes (via LitePsmJob) |
| `distribute()` | REWARDS_DIST_USDS_SKY | `0xC8d67Fcf101d3f89D0e1F3a2857485A84072a63F` | Distribute USDS->SKY farming rewards | Yes (via RewardsDistJob) |
| `distribute()` | REWARDS_DIST_USDS_SPK | `0x3959e23A63CA7ac12D658bb44F90cb1f7Ee4C02c` | Distribute USDS->SPK farming rewards | Yes (via RewardsDistJob) |
| `distribute()` | REWARDS_DIST_LSSKY_SPK | `0xa3Ee378BdD0b7DD403cEd3a0A65B2B389A2eaB7e` | Distribute locked SKY->SPK farming rewards | Yes (via RewardsDistJob) |
| `distribute()` | REWARDS_DIST_LSSKY_SKY | `0x675671A8756dDb69F7254AFB030865388Ef699Ee` | Distribute locked SKY->SKY farming rewards | Yes (via RewardsDistJob) |

## Guardian/Circuit Breaker Contracts (MOM)

Guardian contracts allow emergency actions without the standard governance timelock. These are targets for emergency keeper automation.

| Contract | Address | Purpose |
|----------|---------|---------|
| OSM_MOM | `0x76416A4d5190d071bfed309861527431304aA14f` | Emergency halt oracle price feeds |
| CLIPPER_MOM | `0x79FBDF16b366DFb14F66cE4Ac2815Ca7296405A0` | Emergency halt clipper auctions |
| DIRECT_MOM | `0x1AB3145E281c01a1597c8c62F9f060E8e3E02fAB` | Emergency halt Direct Deposit Modules (D3M) |
| LINE_MOM | `0x9c257e5Aaf73d964aEBc2140CA38078988fB0C10` | Emergency wipe debt ceiling lines |
| LITE_PSM_MOM | `0x467b32b0407Ad764f56304420Cddaa563bDab425` | Emergency halt LitePSM operations |
| SPLITTER_MOM | `0xF51a075d468dE7dE3599C1Dc47F5C42d02C9230e` | Emergency halt surplus splitter |
| STARKNET_ESCROW_MOM | `0xc238E3D63DfD677Fa0FA9985576f0945C581A266` | Emergency halt Starknet bridge escrow |
| STUSDS_MOM | `0xf5DEe2CeDC5ADdd85597742445c0bf9b9cAfc699` | Emergency halt stUSDS rate setting |
| SPBEAM_MOM | `0xf0C6e6Ec8B367cC483A411e595D3Ba9B287D5c5` | Emergency halt SpBeam parameter changes |

### Emergency Single-Purpose (EMSP) Contracts

Pre-authorized emergency spells that can be triggered without governance vote:

| Contract | Address | Purpose |
|----------|---------|---------|
| EMSP_CLIP_BREAKER_FAB | `0x867852D30bb3CB1411fB4e404FAE28EF742b1023` | Factory for clip breaker emergency spells |
| EMSP_GLOBAL_CLIP_BREAKER | `0x828824dBC62Fba126C76E0Abe79AE28E5393C2cb` | Global clipper auction halt |
| EMSP_GLOBAL_OSM_STOP | `0x3021dEdB0bC677F43A23Fcd1dE91A07e5195BaE8` | Global oracle halt |
| EMSP_GLOBAL_LINE_WIPE | `0x4B5f856B59448304585C2AA009802A16946DDb0f` | Global debt ceiling wipe |
| EMSP_SPLITTER_STOP | `0x12531afC02aC18a9597Cfe8a889b7B948243a60b` | Splitter halt |
| EMSP_DDM_DISABLE_FAB | `0x8BA0f6C4009Ea915706e1bCfB1d685bBa61007DfB` | D3M disable factory |
| EMSP_LITE_PSM_HALT_FAB | `0xB261b73698F6dBC03cB1E998A3176bdD81C3514A` | LitePSM halt factory |
| EMSP_SPBEAM_HALT | `0xDECF4A7E4b9CAa3c3751D163866941a888618Ac0` | SpBeam halt |
| EMSP_OSM_STOP_FAB | `0x83211c74131bA2B3de7538f588f1c2f309e81eF0` | OSM stop factory |
| EMSP_LINE_WIPE_FAB | `0x8646F8778B58a0dF118FacEdf522181bA7277529` | Line wipe factory |

## External Automation Services

| Service | What It Automates | Status | Funding |
|---------|-------------------|--------|---------|
| TechOps | MegaPoker (oracle poke), general keeper ops | Active | 1,500 DAI/day, 3-year stream |
| Chainlink Automation V2.1 | All dss-cron jobs via DssCronKeeper | Active | 1,000 DAI/day (181,000 DAI / 6 months) |
| Keep3r Network | dss-cron jobs via maker-keeper-scripts | Archived Jul 2025 | 1,500 DAI/day, 3-year stream |
| Gelato Network | dss-cron jobs | Active | 1,000 DAI/day (183,000 DAI / 6 months) |

**Key contracts**:
- Chainlink DssCronKeeper: [hackbg/chainlink-makerdao-automation](https://github.com/hackbg/chainlink-makerdao-automation)
- Keep3r integration (archived): [defi-wonderland/maker-keeper-scripts](https://github.com/defi-wonderland/maker-keeper-scripts) - Keep3r V2 `0xeb02addCfD8B773A5FFA6B9d1FE99c566f8c44CC`, Upkeep Job `0x5D469E1ef75507b0E0439667ae45e280b9D81B9C`
- Gelato adapter: via dss-cron adapter contracts

## KeeperHub Opportunity Assessment

### Immediately Automatable (ranked by simplicity)

These keepers can be run TODAY with existing KeeperHub capabilities using the standard cron pattern:

**1. RewardsDistJob -- Vested Rewards Distribution** (simplest, highest value)
- Contract: `0x6464C34A02DD155dd0c630CE233DD6e21C24F9A5`
- Pattern: Schedule (every 6 hours) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Runs on 7-day intervals, distributes SKY/SPK farming rewards. Simple workable/work pattern. Low gas.

**2. FlapJob -- Smart Burn Engine Trigger** (simple, economically important)
- Contract: `0xE564C4E237f4D7e0130FdFf6ecC8a5E931C51494`
- Pattern: Schedule (every 5 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true AND gas < 138 gwei) -> `write-contract` call `work(bytes32)`
- Why: Triggers MKR buy-and-burn surplus auctions. Has built-in gas price guard. Directly impacts protocol economics.

**3. AutoLineJob -- Debt Ceiling Adjustment** (simple, critical infrastructure)
- Contract: `0x67AD4000e73579B9725eE3A149F85C4Af0A61361`
- Pattern: Schedule (every 1 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Adjusts debt ceilings when vault utilization hits thresholds. High-frequency check needed but low execution frequency.

**4. LerpJob -- Linear Parameter Interpolation** (simple)
- Contract: `0x8F8f2FC1F0380B9Ff4fE5c3142d0811aC89E32fB`
- Pattern: Schedule (every 30 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Executes gradual parameter changes. Max 1-day TTL.

**5. D3MJob -- Direct Deposit Module Management** (simple)
- Contract: `0x2Ea4aDE144485895B923466B4521F5ebC03a0AeF`
- Pattern: Schedule (every 5 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Manages D3M positions in Aave, Spark, Compound. 10-minute TTL. Threshold=500 bps.

**6. LitePsmJob -- PSM Bookkeeping** (simple)
- Contract: `0x0C86162ba3E507592fC8282b07cF18c7F902C401`
- Pattern: Schedule (every 5 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Maintains DAI/USDC balance in LitePSM via fill(), trim(), chug(). Critical for peg stability.

**7. ClipperMomJob -- Liquidation Circuit Breaker** (simple but event-driven)
- Contract: `0x7E93C4f61C8E8874e7366cDbfeFF934Ed089f9fF`
- Pattern: Schedule (every 1 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Governance-triggered liquidation halt. Rarely fires but critical when it does.

**8. StarGuardJob -- Star Agent Stability Monitoring** (simple)
- Contract: `0xB18d211fA69422a9A848B790C5B4a3957F7Aa44E`
- Pattern: Schedule (every 5 min) -> `read-contract` call `workable(bytes32)` -> Condition (if true) -> `write-contract` call `work(bytes32)`
- Why: Monitors stability of Star Agent modules (Spark, Grove, Keel, Obex, etc.).

**9. MCD_JUG drip() -- Stability Fee Accrual** (simplest standalone)
- Contract: `0x19c0976f590D67707E62397C87829d896Dc0f1F1`
- Pattern: Schedule (every 1 hour) -> `write-contract` call `drip(bytes32 ilk)` for each active collateral type
- Why: Zero-parameter keeper (per ilk). Accrues stability fees. Usually called as part of MegaPoker but can be called independently.

**10. MCD_POT drip() -- DSR Yield Accrual** (simplest standalone)
- Contract: `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7`
- Pattern: Schedule (every 1 hour) -> `write-contract` call `drip()`
- Why: Zero-parameter keeper. Updates DSR yield accumulator. Very simple.

### Requires New Features

| Keeper | What's Needed | Complexity |
|--------|--------------|------------|
| OracleJob (full poke cycle) | Multi-contract batch calls (poke all PIPs + SPOT in one workflow) | Medium -- needs `web3/multicall` or sequential multi-write |
| Chief Keeper | Continuous block monitoring, local state tracking, complex governance logic | High -- needs event-driven triggers + persistent state |
| Emergency MOM triggers | Monitoring for anomalous conditions + fast execution | Medium -- needs anomaly detection conditions |
| SpBeam parameter changes | bytes32 encoded ilk parameters, rate conversions | Low -- needs bytes32 encoding support |

### Not Suitable for KeeperHub

| Keeper | Why Not |
|--------|---------|
| Auction Keeper (clip/flap/flop participation) | Requires bidding models, capital for collateral purchase, flash loan integration, MEV protection, and atomic multi-step transactions |
| Arbitrage Keeper | Requires DEX routing, price modeling, atomic swaps, capital management |
| Market Maker Keeper | Requires exchange API integrations, order book management, capital management, risk management |
| LockStake Liquidation Keeper | Modified liquidation flow (ERC20 collateral instead of vat.gem), requires custom callee contracts and DEX integration |

## Sources

- [Sky Chainlog API](https://chainlog.sky.money/api/mainnet/active.json)
- [Sky Developer Docs](https://developers.sky.money/)
- [dss-cron Repository](https://github.com/makerdao/dss-cron)
- [MegaPoker Repository](https://github.com/makerdao/megapoker)
- [Chief Keeper Repository](https://github.com/sky-ecosystem/chief-keeper)
- [Auction Keeper Repository](https://github.com/makerdao/auction-keeper)
- [Cage Keeper Docs](https://docs.makerdao.com/keepers/cage-keeper)
- [Maker Keeper Repository](https://github.com/sky-ecosystem/maker-keeper)
- [Chainlink MakerDAO Automation](https://github.com/hackbg/chainlink-makerdao-automation)
- [Keep3r Maker Scripts](https://github.com/defi-wonderland/maker-keeper-scripts) (archived)
- [Keeper Developer Guides](https://github.com/sky-ecosystem/developerguides/blob/master/keepers/README.md)
- [Keeper Network Follow-up Updates (Forum)](https://forum.sky.money/t/poll-notice-keeper-network-follow-up-updates/21056)
- [LitePSM Docs](https://developers.sky.money/guides/psm/litepsm/)
- [SpBeam Repository](https://github.com/sky-ecosystem/sp-beam)
- [Liquidation 2.0 Docs](https://docs.makerdao.com/smart-contract-modules/dog-and-clipper-detailed-documentation)
