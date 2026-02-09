# Protocol Analysis: Sky (formerly MakerDAO)

**Category**: Lending / Stablecoin / Savings
**Chain**: Ethereum Mainnet (chain ID: `1`)
**Documentation**: [Sky Developer Docs](https://developers.sky.money/) | [Chainlog](https://chainlog.sky.money/)

## Key Contracts

| Contract | Address | Role |
|----------|---------|------|
| USDS | `0xdC035D45d973E3EC169d2276DDab16f1e407384F` | Sky stablecoin (upgraded DAI) |
| sUSDS | `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` | Savings USDS -- ERC-4626 vault, earns Sky Savings Rate |
| SKY | `0x56072C95FAA701256059aa122697B133aDEd9279` | Governance token (upgraded MKR) |
| MCD_VAT | `0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B` | Core accounting engine -- tracks all debt and collateral |
| MCD_JUG | `0x19c0976f590D67707E62397C87829d896Dc0f1F1` | Stability fee accrual module |
| MCD_POT | `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7` | DAI Savings Rate (legacy DSR) module |
| MCD_DOG | `0x135954d155898D42C90D2a57824C690e0c7BEf1B` | Liquidation module -- triggers vault liquidations |
| MCD_SPOT | `0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3` | Oracle price feed interface |
| MCD_VOW | `0xA950524441892A31ebddF91d3cEEFa04Bf454466` | System surplus/debt accounting |

## Additional Contracts

| Contract | Address | Role |
|----------|---------|------|
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | Legacy stablecoin |
| MKR | `0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2` | Legacy governance token |
| stUSDS | `0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9` | Staked USDS token |
| DAI_USDS Converter | `0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A` | Bidirectional DAI-USDS 1:1 converter |
| MKR_SKY Converter | `0xA1Ea1bA18E88C381C724a75F23a130420C403f9a` | One-way MKR to SKY converter (1:24000 ratio) |
| USDS_JOIN | `0x3C0f895007CA717Aa01c8693e59DF1e8C3777FEB` | USDS join adapter |
| LOCKSTAKE_ENGINE | `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3` | SKY staking engine |
| REWARDS_USDS_SKY | `0x0650CAF159C5A49f711e8169D4336ECB9b950275` | USDS rewards farm for SKY stakers |
| REWARDS_LSSKY_SKY | `0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc` | SKY rewards farm for locked SKY stakers |
| Chainlog | `0xdA0Ab1e0017DEbCd72Be8599041a2aa3bA7e740F` | On-chain contract registry |

## Protocol Overview

Sky (formerly MakerDAO) is the protocol behind USDS (formerly DAI), the largest decentralized stablecoin in DeFi. The protocol allows users to deposit collateral (ETH, WBTC, and other assets) into Vaults to mint USDS, which is soft-pegged to the US dollar. Vault owners pay stability fees on their minted USDS, and the protocol uses these fees to fund the Sky Savings Rate (SSR) paid to USDS holders who deposit into the sUSDS savings vault.

The protocol underwent a major rebrand from MakerDAO to Sky in September 2024. DAI was upgraded to USDS, MKR was upgraded to SKY (at 1:24,000 ratio), and the Dai Savings Rate (DSR) became the Sky Savings Rate (SSR). Legacy tokens remain fully functional with bidirectional converters. The sUSDS token is an ERC-4626 vault that automatically accrues SSR yield -- its exchange rate against USDS increases continuously as yield accumulates.

Sky also features a Staking Engine where SKY holders can stake tokens to earn USDS rewards, delegate governance voting rights, and borrow USDS. The protocol has a sophisticated liquidation system (MCD_DOG + Clipper auctions) that protects the system when vault collateral values drop. Over 500 smart contracts make up the full system, tracked via an on-chain chainlog registry.

## sUSDS (Savings USDS) -- ERC-4626 Interface

The most important user-facing contract. Address: `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`

### Key Functions

**Deposit/Withdraw**:
- `deposit(uint256 assets, address receiver, uint16 referral)` -- deposit USDS, receive sUSDS shares
- `withdraw(uint256 assets, address receiver, address owner)` -- withdraw USDS, burn sUSDS
- `mint(uint256 shares, address receiver, uint16 referral)` -- mint exact sUSDS shares
- `redeem(uint256 shares, address receiver, address owner)` -- redeem sUSDS for USDS

**Read/Preview**:
- `convertToShares(uint256 assets)` -- USDS to sUSDS conversion
- `convertToAssets(uint256 shares)` -- sUSDS to USDS conversion (shows accrued yield)
- `totalAssets()` -- total USDS held in the vault
- `previewDeposit(uint256 assets)` / `previewWithdraw(uint256 assets)`
- `maxDeposit(address)` / `maxWithdraw(address owner)`
- `asset()` -- returns USDS token address

### Events
- `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)`
- `Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)`
- `Referral(uint16 indexed referral, address indexed owner, uint256 assets, uint256 shares)`

## Pool/Core Events

### MCD_DOG -- Liquidation Module (`0x135954d155898D42C90D2a57824C690e0c7BEf1B`)
- `Bark(bytes32 indexed ilk, address indexed urn, uint256 ink, uint256 art, uint256 due, address clip, uint256 id)` -- vault liquidation triggered

### MCD_VAT -- Core Accounting (`0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B`)
- `frob` -- vault collateral/debt adjustment (modify CDP)
- `grab` -- liquidation seizure
- `fold` -- rate accumulation

### MCD_JUG -- Stability Fees (`0x19c0976f590D67707E62397C87829d896Dc0f1F1`)
- `drip(bytes32 ilk)` -- accrue stability fees for a collateral type

## KeeperHub Automation Opportunities

### Monitoring & Alerts

#### 1. Sky Savings Rate (SSR) Monitor

**Trigger**: Schedule (hourly)
**What it does**: Reads the current sUSDS exchange rate to track SSR yield accrual over time.

**Workflow nodes**:
1. Schedule trigger - cron `0 * * * *`
2. `web3/read-contract` - Call `convertToAssets(1000000000000000000)` on sUSDS (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`), network `1`
3. `webhook/send-webhook` - POST rate data to analytics endpoint

**Use case**: Yield tracking, SSR rate monitoring, comparing against other savings products.
**Complexity**: Low

#### 2. sUSDS TVL Monitor

**Trigger**: Schedule (every 4 hours)
**What it does**: Reads total assets in the sUSDS vault and alerts on significant changes.

**Workflow nodes**:
1. Schedule trigger - cron `0 */4 * * *`
2. `web3/read-contract` - Call `totalAssets()` on sUSDS (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`), network `1`
3. `webhook/send-webhook` - POST TVL data

**Use case**: Protocol health monitoring, TVL tracking dashboards.
**Complexity**: Low

#### 3. Vault Liquidation Watcher

**Trigger**: Event (Bark on MCD_DOG)
**What it does**: Listens for vault liquidation events and sends alerts with collateral type, debt, and auction details.

**Workflow nodes**:
1. Event trigger - `Bark(bytes32 indexed ilk, address indexed urn, uint256 ink, uint256 art, uint256 due, address clip, uint256 id)` on MCD_DOG (`0x135954d155898D42C90D2a57824C690e0c7BEf1B`), network `1`
2. `webhook/send-webhook` - POST `{ ilk, urn, ink, art, due, clip, id }`

**Use case**: Liquidation monitoring, MEV/keeper bot coordination, protocol risk tracking.
**Complexity**: Low

#### 4. Large sUSDS Deposit/Withdrawal Monitor

**Trigger**: Event (Deposit or Withdraw on sUSDS)
**What it does**: Monitors large deposits into or withdrawals from the Sky Savings vault.

**Workflow nodes**:
1. Event trigger - `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)` on sUSDS (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`), network `1`
2. Condition - `assets > 1000000000000000000000000` (> 1M USDS, 18 decimals)
3. `webhook/send-webhook` - POST whale deposit alert

**Use case**: Whale watching, protocol inflow/outflow tracking.
**Complexity**: Low

#### 5. USDS Balance Monitor

**Trigger**: Schedule (every 30 minutes)
**What it does**: Tracks USDS and sUSDS token balances for a specific wallet.

**Workflow nodes**:
1. Schedule trigger - cron `*/30 * * * *`
2. `web3/check-token-balance` - Check USDS balance (`0xdC035D45d973E3EC169d2276DDab16f1e407384F`), network `1`
3. `web3/check-token-balance` - Check sUSDS balance (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`), network `1`
4. `webhook/send-webhook` - POST combined balance data

**Use case**: Treasury tracking, portfolio monitoring.
**Complexity**: Low

### Automated Actions

#### 6. Auto-Deposit USDS into Sky Savings

**Trigger**: Schedule (daily) or Webhook
**What it does**: Checks wallet for idle USDS and automatically deposits into sUSDS to earn SSR yield.

**Workflow nodes**:
1. Schedule trigger - cron `0 9 * * *`
2. `web3/check-token-balance` - Check USDS balance in wallet, network `1`
3. Condition - Balance above minimum threshold
4. `web3/write-contract` - Call `deposit(uint256 assets, address receiver, uint16 referral)` on sUSDS (`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`). Requires wallet integration + USDS approval.
5. `webhook/send-webhook` - POST deposit confirmation

**Use case**: Treasury yield optimization, auto-compounding idle stablecoin holdings.
**Complexity**: High (requires token approval)

#### 7. Auto-Convert DAI to USDS

**Trigger**: Schedule (daily) or Webhook
**What it does**: Checks for DAI holdings and auto-converts them to USDS via the converter contract.

**Workflow nodes**:
1. Schedule trigger - cron `0 10 * * *`
2. `web3/check-token-balance` - Check DAI balance (`0x6B175474E89094C44Da98b954EedeAC495271d0F`), network `1`
3. Condition - DAI balance > 0
4. `web3/write-contract` - Call converter on DAI_USDS (`0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A`). Requires wallet integration + DAI approval.
5. `webhook/send-webhook` - POST conversion confirmation

**Use case**: Migrating legacy DAI holdings to USDS automatically.
**Complexity**: High (requires token approval)

#### 8. Auto-Upgrade MKR to SKY

**Trigger**: Webhook or Manual
**What it does**: Converts MKR holdings to SKY tokens at the protocol rate of 1:24,000.

**Workflow nodes**:
1. Manual or Webhook trigger
2. `web3/check-token-balance` - Check MKR balance (`0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2`), network `1`
3. Condition - MKR balance > 0
4. `web3/write-contract` - Call converter on MKR_SKY (`0xA1Ea1bA18E88C381C724a75F23a130420C403f9a`). Requires wallet integration + MKR approval. Note: One-way conversion with 1% penalty increasing every 3 months.
5. `webhook/send-webhook` - POST conversion confirmation

**Use case**: Token migration for MKR holders upgrading to Sky governance. Time-sensitive due to increasing penalty.
**Complexity**: Medium (one-way, irreversible)

### Scheduled Tasks

#### 9. Daily Savings Yield Report

**Trigger**: Schedule (daily)
**What it does**: Reads sUSDS conversion rate and calculates daily yield earned.

**Workflow nodes**:
1. Schedule trigger - cron `0 8 * * *`
2. `web3/read-contract` - Call `convertToAssets(1000000000000000000)` on sUSDS, network `1`
3. `web3/read-contract` - Call `totalAssets()` on sUSDS, network `1`
4. `webhook/send-webhook` - POST daily yield snapshot

**Use case**: Yield reporting, performance tracking, treasury accounting.
**Complexity**: Low

#### 10. Stability Fee Rate Check

**Trigger**: Schedule (every 6 hours)
**What it does**: Reads current stability fee rates from the Jug contract for key collateral types.

**Workflow nodes**:
1. Schedule trigger - cron `0 */6 * * *`
2. `web3/read-contract` - Call `ilks(bytes32)` on MCD_JUG (`0x19c0976f590D67707E62397C87829d896Dc0f1F1`), network `1` for ETH-A, WBTC-A, etc.
3. `webhook/send-webhook` - POST rate data

**Use case**: Borrowing cost monitoring, governance parameter tracking.
**Complexity**: Medium (bytes32 encoding for ilk names)

### Event-Driven Workflows

#### 11. sUSDS Deposit Webhook Relay

**Trigger**: Event (Deposit on sUSDS)
**What it does**: Captures all sUSDS deposits and relays them to an external system.

**Workflow nodes**:
1. Event trigger - `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)` on sUSDS, network `1`
2. `webhook/send-webhook` - POST `{ sender, owner, assets, shares }` to analytics endpoint

**Use case**: Analytics, referral tracking (sUSDS has a referral parameter), protocol monitoring.
**Complexity**: Low

#### 12. sUSDS Withdrawal Alert

**Trigger**: Event (Withdraw on sUSDS)
**What it does**: Monitors all withdrawals from Sky Savings and alerts.

**Workflow nodes**:
1. Event trigger - `Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)` on sUSDS, network `1`
2. Condition - Filter for specific address or large amount
3. `webhook/send-webhook` - POST withdrawal alert

**Use case**: Tracking large outflows, monitoring specific wallets.
**Complexity**: Low

#### 13. Token Converter Usage Tracker

**Trigger**: Event (on DAI_USDS converter)
**What it does**: Monitors DAI-to-USDS conversion activity to track migration progress.

**Workflow nodes**:
1. Event trigger - Transfer events on DAI_USDS converter (`0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A`), network `1`
2. `webhook/send-webhook` - POST conversion data

**Use case**: Migration tracking, protocol adoption metrics.
**Complexity**: Low

## Gap Analysis

### Actions KeeperHub Should Build

| Gap | What Protocol Needs | Why It Matters | Suggested Feature |
|-----|-------------------|----------------|-------------------|
| Token Approval Action | ERC20 `approve()` before deposit/convert | Every write interaction (sUSDS deposit, DAI conversion, MKR upgrade) requires prior approval | `web3/approve-token` action |
| bytes32 Encoding | Ilk names are bytes32-encoded (e.g., `ETH-A` = `0x4554482d41...`) | Reading vault parameters from MCD_JUG and MCD_VAT requires encoding string ilk names to bytes32 | Support bytes32 encoding in function args |
| Multi-Call Batch Read | Reading multiple collateral types or multiple sUSDS metrics in one step | Stability fee monitoring across 10+ collateral types requires 10+ separate read-contract nodes | `web3/multicall-read` action |
| Math/Compute Node | Converting RAY (27 decimal) stability fees and savings rates to human-readable percentages | All rates are stored as per-second compound rates in 27 decimal RAY format | `system/compute` node for BigInt math |

### Missing Triggers & Integrations

| Gap | Current Limitation | Impact | Recommendation |
|-----|-------------------|--------|----------------|
| Governance Vote Trigger | No trigger for Sky governance votes or spell executions | Rate changes, new collateral types, and parameter updates happen via governance. Users want alerts when key votes pass. | Monitor MCD_PAUSE or governance spell events |
| State Comparison Between Runs | No persistent state between schedule executions | SSR rate change detection requires comparing current convertToAssets output to the previous reading | Add persistent workflow variables |
| Price Feed Trigger | No native oracle/price trigger | Vault owners need alerts when collateral price approaches liquidation threshold. Oracle data comes from MCD_SPOT. | Add price alert trigger using on-chain oracles |

### Platform Improvements

| Gap | Current Limitation | Impact | Recommendation |
|-----|-------------------|--------|----------------|
| BigInt Condition Comparison | Condition nodes may not handle 18/27 decimal uint256 values | sUSDS assets, stability fees, and savings rates are all large uint256 values | Ensure string-based BigInt comparison in conditions |
| Loop/Iteration Node | No iteration over collateral types or multiple vaults | Sky has 50+ collateral types; monitoring rates requires one node per type | Add `for-each` node type |
| ERC-4626 Template | No pre-built template for ERC-4626 vault monitoring | sUSDS is one of many ERC-4626 vaults in DeFi; a generic template would cover dozens of protocols | Create "ERC-4626 Vault Monitor" template |
| Vault Health Monitoring | No simple way to query a specific user's vault health | Sky vaults use ilk+urn addressing via the VAT, which requires bytes32 encoding and multi-step reads | Build a "Sky Vault Health" workflow template |

### Priority Recommendations

1. **High**: Math/Compute node + BigInt support -- Sky rates use 27-decimal RAY format. Without conversion, conditions on savings rates and stability fees are unusable.
2. **High**: Persistent workflow state -- SSR rate change detection (the most common monitoring use case) requires comparing current vs. previous readings.
3. **Medium**: bytes32 encoding support -- querying vault parameters requires encoding ilk names (`ETH-A`, `WBTC-A`) to bytes32, which is a common pattern across all Maker/Sky contracts.
4. **Medium**: ERC-4626 vault template -- sUSDS is the largest ERC-4626 vault by TVL ($4.6B). A generic template covers sUSDS, sDAI, and dozens of other yield vaults.
5. **Low**: Token approval UX action -- `write-contract` can call `approve()` directly.
6. **Low**: Governance vote monitoring -- important but less frequent than savings/liquidation monitoring.

## Quick Start

**Simplest high-value automation: Sky Savings Rate Monitor**

This is read-only and works immediately with no wallet integration:

1. Create workflow with **Schedule trigger**: `0 * * * *` (hourly)

2. Add **`web3/read-contract`** node:
   - Network: `1` (Ethereum Mainnet)
   - Contract: `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` (sUSDS)
   - Function: `convertToAssets`
   - Args: `["1000000000000000000"]` (1 sUSDS in wei)
   - Returns: current USDS value of 1 sUSDS (increases over time as yield accrues)

3. Add **`web3/read-contract`** node:
   - Contract: `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` (sUSDS)
   - Function: `totalAssets`
   - Returns: total USDS deposited in Sky Savings

4. Add **`webhook/send-webhook`** node:
   - Method: POST
   - Payload: `{"sUSDS_rate": "{{node-2 output}}", "total_savings": "{{node-3 output}}", "timestamp": "{{$now}}"}`

**To extend**: Add a Condition node to alert only when the rate changes beyond a threshold, or add a second workflow monitoring sUSDS Deposit/Withdraw events for whale tracking.

## Sources

- [Sky Developer Documentation](https://developers.sky.money/)
- [Chainlog API](https://chainlog.sky.money/api.html)
- [sUSDS on Etherscan](https://etherscan.io/address/0xa3931d71877c0e7a3148cb7eb4463524fec27fbd)
- [USDS on Etherscan](https://etherscan.io/address/0xdc035d45d973e3ec169d2276ddab16f1e407384f)
- [SKY on Etherscan](https://etherscan.io/address/0x56072c95faa701256059aa122697b133aded9279)
- [MKR-SKY Converter on Etherscan](https://etherscan.io/address/0xA1Ea1bA18E88C381C724a75F23a130420C403f9a)
- [sUSDS Token Docs (Spark)](https://docs.spark.fi/dev/savings/susds-token)
- [Sky Staking Engine Docs](https://developers.sky.money/protocol/rewards/staking-engine/)
