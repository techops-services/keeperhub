# Safe Protocol: Automation Gap Analysis & Workflow Suggestions

## 1. Target Analysis

**Protocol**: Safe (formerly Gnosis Safe) -- the leading multi-signature wallet and smart account infrastructure for Web3
**Category**: Smart Account / Multi-Signature Wallet Infrastructure
**Chains**: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche, BNB Chain, Gnosis Chain, and 20+ additional networks
**TVL**: $100B+ in assets secured across 30+ networks
**Documentation**: https://docs.safe.global

### Key Contracts (Ethereum Mainnet)

| Contract | Address | Role |
|----------|---------|------|
| Safe Singleton (v1.4.1) | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | Master copy for proxy pattern |
| Safe Singleton (v1.3.0) | `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552` | Legacy master copy (most deployed Safes use this) |
| SafeL2 Singleton (v1.3.0) | `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` | L2-optimized singleton with event emission |
| SafeProxyFactory (v1.4.1) | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | Creates proxy Safes |
| MultiSend (v1.4.1) | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` | Batch multiple transactions |
| CompatibilityFallbackHandler (v1.4.1) | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` | Default fallback handler (EIP-1271) |

**NOTE**: Most deployed Safes in production use v1.3.0 contracts. Always verify the specific Safe version by calling `VERSION()` on the proxy before building workflows.

### Core Functions

#### Transaction Execution

| Function | Purpose | Permissioned |
|----------|---------|--------------|
| `execTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures)` | Execute with collected signatures | Requires threshold signatures |
| `approveHash(bytes32 hashToApprove)` | Pre-approve a transaction hash on-chain | Only owners |
| `nonce()` | Current transaction nonce | View |
| `getTransactionHash(...)` | Compute transaction hash for signing | View |

#### Owner Management

| Function | Purpose | Permissioned |
|----------|---------|--------------|
| `addOwnerWithThreshold(address, uint256)` | Add owner + update threshold | Only via Safe tx |
| `removeOwner(address, address, uint256)` | Remove owner + update threshold | Only via Safe tx |
| `swapOwner(address, address, address)` | Replace an owner | Only via Safe tx |
| `changeThreshold(uint256)` | Change signature threshold | Only via Safe tx |
| `getOwners()` | List all owners | View |
| `getThreshold()` | Current threshold | View |
| `isOwner(address)` | Check if address is owner | View |

#### Module Management

| Function | Purpose | Permissioned |
|----------|---------|--------------|
| `enableModule(address)` | Enable a module | Only via Safe tx |
| `disableModule(address, address)` | Disable a module | Only via Safe tx |
| `execTransactionFromModule(to, value, data, operation)` | Execute from enabled module | Only enabled modules |
| `isModuleEnabled(address)` | Check if module is enabled | View |
| `getModulesPaginated(address, uint256)` | List enabled modules | View |

#### Guard and Fallback

| Function | Purpose | Permissioned |
|----------|---------|--------------|
| `setGuard(address)` | Set transaction guard | Only via Safe tx |
| `setFallbackHandler(address)` | Set fallback handler | Only via Safe tx |

### Core Events

| Event | Signature | Emitted When |
|-------|-----------|--------------|
| `SafeSetup` | `SafeSetup(address indexed initiator, address[] owners, uint256 threshold, address initializer, address fallbackHandler)` | Safe is initialized |
| `ExecutionSuccess` | `ExecutionSuccess(bytes32 indexed txHash, uint256 payment)` | Transaction executed successfully |
| `ExecutionFailure` | `ExecutionFailure(bytes32 indexed txHash, uint256 payment)` | Transaction execution failed |
| `AddedOwner` | `AddedOwner(address indexed owner)` | New owner added |
| `RemovedOwner` | `RemovedOwner(address indexed owner)` | Owner removed |
| `ChangedThreshold` | `ChangedThreshold(uint256 threshold)` | Signature threshold changed |
| `EnabledModule` | `EnabledModule(address indexed module)` | Module enabled |
| `DisabledModule` | `DisabledModule(address indexed module)` | Module disabled |
| `ChangedGuard` | `ChangedGuard(address indexed guard)` | Guard contract changed |
| `ApproveHash` | `ApproveHash(bytes32 indexed approvedHash, address indexed owner)` | Owner pre-approved a hash |
| `SignMsg` | `SignMsg(bytes32 indexed msgHash)` | Message signed via SignMessageLib |
| `SafeReceived` | `SafeReceived(address indexed sender, uint256 value)` | ETH received |
| `SafeModuleTransaction` | `SafeModuleTransaction(address module, address to, uint256 value, bytes data, uint8 operation)` | L2 only: Module executed a tx |

### Key ABI (Monitoring Subset)

```json
[
  {"inputs":[],"name":"nonce","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getThreshold","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getOwners","outputs":[{"name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"owner","type":"address"}],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"module","type":"address"}],"name":"isModuleEnabled","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"start","type":"address"},{"name":"pageSize","type":"uint256"}],"name":"getModulesPaginated","outputs":[{"name":"array","type":"address[]"},{"name":"next","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"VERSION","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"txHash","type":"bytes32"},{"indexed":false,"name":"payment","type":"uint256"}],"name":"ExecutionSuccess","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"txHash","type":"bytes32"},{"indexed":false,"name":"payment","type":"uint256"}],"name":"ExecutionFailure","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"AddedOwner","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"RemovedOwner","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"name":"threshold","type":"uint256"}],"name":"ChangedThreshold","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"module","type":"address"}],"name":"EnabledModule","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"module","type":"address"}],"name":"DisabledModule","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"guard","type":"address"}],"name":"ChangedGuard","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"approvedHash","type":"bytes32"},{"indexed":true,"name":"owner","type":"address"}],"name":"ApproveHash","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"SafeReceived","type":"event"}
]
```

### Existing Automation Infrastructure

#### Safe Transaction Service (Off-Chain Queue)

Centralized off-chain backend managing the transaction lifecycle:
- Queues proposed transactions from any owner
- Collects off-chain signatures from owners
- Tracks nonces and ordering
- Allows submission once threshold signatures are collected

API base (Ethereum mainnet): `https://safe-transaction-mainnet.safe.global`
- `GET /api/v1/safes/{address}/` -- Safe info (owners, threshold, nonce)
- `GET /api/v1/safes/{address}/multisig-transactions/` -- Transaction history
- `POST /api/v1/safes/{address}/multisig-transactions/` -- Propose new transaction

**Limitation**: Centralized service. If it goes down, signature collection and queuing stop for all users.

#### Safe{Wallet} Web Interface

`app.safe.global` -- Manual-only. Transaction creation, batching, WalletConnect, spending limits. **Zero built-in automation, alerting, or scheduling.**

#### Zodiac Modules (Gnosis Guild)

| Module | Purpose | KeeperHub Relevance |
|--------|---------|---------------------|
| Roles Modifier | Granular function-level permission scoping | A KeeperHub wallet could be granted a "keeper" role to execute specific operations without full multisig threshold |
| Reality Module | Execute txs based on Snapshot/Reality.eth outcomes | Bridge governance votes to on-chain execution |
| Delay Module | Time delay before module txs execute | Safety mechanism for automated ops |
| Bridge Module | Cross-chain message passing | L1-to-L2 Safe coordination |
| Exit Module | Ragequit / proportional redemption | DAO treasury exit |

### Identified Automation Gaps

1. **No transaction queue monitoring** -- No alerts when proposals are created, signatures pending, or queue stale
2. **No owner/threshold change alerting** -- Critical security events go unnoticed
3. **No module installation alerting** -- The most dangerous attack vector (modules bypass signatures)
4. **No guard change alerting** -- Security constraints silently removed
5. **No nonce/stuck transaction detection** -- Stuck nonces block entire queue with no alert
6. **No cross-chain Safe coordination** -- Owner/threshold sync is entirely manual
7. **No failed transaction alerting** -- `ExecutionFailure` means gas wasted, operation failed
8. **No delegate spending monitoring** -- Allowance module abuse goes undetected

---

## 2. Capability Source

**Source: MCP (KeeperHub action schemas endpoint)** -- authoritative, reflects latest platform capabilities.

### Confirmed Available

**Triggers**: Manual, Schedule (cron), Webhook (HTTP), Event (blockchain events), Block (block intervals)

**Actions**:
- **Web3**: `check-balance`, `check-token-balance`, `transfer-funds`, `transfer-token`, `read-contract`, `write-contract`, `get-transaction`, `decode-calldata`, `assess-risk`, `query-events`
- **System**: `Condition` (gate logic), `HTTP Request` (external API calls), `Database Query` (state persistence), `For Each` (loops), `Collect` (aggregation)
- **Messaging**: `discord/send-message`, `sendgrid/send-email`, `telegram/send-message`, `slack/send-message`
- **Webhook**: `webhook/send-webhook` (outbound HTTP)

**Chains**: Ethereum (1), Base (8453), Sepolia (11155111), Base Sepolia (84532), Solana (101), Tempo Testnet (42429)

---

## 3. Workflow Suggestions

### Workflow 1: Owner Change Alert

**The gap**: No alerting when Safe owners are added or removed -- a key attack step (add malicious owner, then lower threshold)
**The idea**: Real-time event-driven alert whenever the owner set of a monitored Safe changes
**Value**: Detect unauthorized access changes within seconds instead of hours/days of manual UI checking

**Trigger**: Event -- `AddedOwner(address indexed owner)` on Safe proxy
(EXISTING)

**Nodes**:
1. Read Contract -- `getThreshold()` on Safe to get current threshold for context (EXISTING: `web3/read-contract`)
2. Read Contract -- `getOwners()` on Safe to get full current owner list (EXISTING: `web3/read-contract`)
3. Discord -- Alert with new owner address, current threshold, owner list, and tx hash (EXISTING: `discord/send-message`)
4. SendGrid -- Email alert to security team (EXISTING: `sendgrid/send-email`)

**Flow**:
```
[Event: AddedOwner] -> [Read Threshold] -> [Read Owners] -> [Discord Alert]
                                                          -> [Email Alert]
```

**Buildable today?**: Yes -- fully buildable. Duplicate workflow for `RemovedOwner`.
**Value proposition**: Any team managing >$100K in a Safe needs this. Currently there is zero alerting for owner changes in the standard Safe interface.

---

### Workflow 2: Module Installation Alert

**The gap**: Enabling a malicious module is the single most dangerous attack on a Safe -- a module can execute arbitrary transactions without signatures. No built-in monitoring exists.
**The idea**: Immediate multi-channel alert when any module is enabled or disabled on a monitored Safe
**Value**: Detect the most critical attack vector (module takeover) in real-time, enabling emergency response before funds are drained

**Trigger**: Event -- `EnabledModule(address indexed module)` on Safe proxy
(EXISTING)

**Nodes**:
1. Read Contract -- `getModulesPaginated(0x1, 10)` to see all currently enabled modules (EXISTING: `web3/read-contract`)
2. Discord -- "CRITICAL: New module enabled on Safe" with module address (EXISTING: `discord/send-message`)
3. SendGrid -- Urgent email to all owners (EXISTING: `sendgrid/send-email`)
4. Webhook -- POST to PagerDuty/OpsGenie incident management (EXISTING: `webhook/send-webhook`)

**Flow**:
```
[Event: EnabledModule] -> [Read All Modules] -> [Discord Alert]
                                              -> [Email Alert]
                                              -> [Webhook to PagerDuty]
```

**Buildable today?**: Yes -- fully buildable. Duplicate for `DisabledModule`.
**Value proposition**: Module installation is the highest-severity event for Safe security. This is table-stakes monitoring for any treasury Safe.

---

### Workflow 3: Threshold Change Alert

**The gap**: Lowering the signature threshold is a key attack step -- reduces the number of compromised keys needed to drain the Safe. No built-in alerting.
**The idea**: Alert when the signature threshold changes, with context about the owner-to-threshold ratio
**Value**: Catch threshold manipulation attacks in real-time

**Trigger**: Event -- `ChangedThreshold(uint256 threshold)` on Safe proxy
(EXISTING)

**Nodes**:
1. Read Contract -- `getOwners()` to get current owner count (EXISTING: `web3/read-contract`)
2. Discord -- Alert with new threshold, owner count, and ratio context (EXISTING: `discord/send-message`)
3. SendGrid -- Email to security team (EXISTING: `sendgrid/send-email`)

**Flow**:
```
[Event: ChangedThreshold] -> [Read Owners] -> [Discord Alert]
                                            -> [Email Alert]
```

**Buildable today?**: Yes -- fully buildable.
**Value proposition**: A 3-of-5 Safe quietly changed to 1-of-5 is a disaster. This catches it instantly.

---

### Workflow 4: Guard Change Alert

**The gap**: Guards enforce pre/post-transaction invariants (e.g., "no transfers over $1M without delay"). Removing a guard silently eliminates these constraints. No alerting exists.
**The idea**: Alert when a guard is changed or removed, with special severity when set to zero address (removal)
**Value**: Detect when security constraints are silently disabled

**Trigger**: Event -- `ChangedGuard(address indexed guard)` on Safe proxy
(EXISTING)

**Nodes**:
1. Condition -- Check if guard == `0x0000000000000000000000000000000000000000` (guard removed) (EXISTING: `Condition`)
2. Discord -- "CRITICAL: Guard removed from Safe" or "Guard changed to {new guard}" (EXISTING: `discord/send-message`)
3. Webhook -- POST to incident management for guard removal (EXISTING: `webhook/send-webhook`)

**Flow**:
```
[Event: ChangedGuard] -> [Condition: guard == 0x0?] -> [Discord: CRITICAL removal]
                                                     -> [Webhook: PagerDuty]
                      -> [Discord: Guard changed to {guard}]
```

**Buildable today?**: Yes -- fully buildable. Use two Condition nodes for the if/else pattern.
**Value proposition**: Guards are the enforcement layer. Removing one is like disabling the alarm system.

---

### Workflow 5: Transaction Execution Monitor with Decoded Context

**The gap**: Teams cannot track what their Safe is doing in real-time. `ExecutionSuccess` and `ExecutionFailure` events provide only a tx hash -- no context about what the transaction actually did.
**The idea**: Monitor all Safe executions, decode the calldata to show human-readable details, and flag failures for investigation
**Value**: Full audit trail of Safe activity with decoded context, plus immediate alerting on failed transactions (wasted gas, failed operations)

**Trigger**: Event -- `ExecutionSuccess(bytes32 indexed txHash, uint256 payment)` on Safe proxy
(EXISTING)

**Nodes**:
1. Get Transaction -- Fetch full tx details by hash from trigger context (EXISTING: `web3/get-transaction`)
2. Decode Calldata -- Decode what the Safe transaction actually did (EXISTING: `web3/decode-calldata`)
3. Assess Risk -- AI-powered risk assessment of the decoded transaction (EXISTING: `web3/assess-risk`)
4. Discord -- Formatted summary with decoded function name, parameters, risk assessment (EXISTING: `discord/send-message`)

**Flow**:
```
[Event: ExecutionSuccess] -> [Get Transaction] -> [Decode Calldata] -> [Assess Risk] -> [Discord Summary]
```

For failures:
```
[Event: ExecutionFailure] -> [Get Transaction] -> [Decode Calldata] -> [Discord: FAILED TX]
                                                                     -> [Email: Ops team]
```

**Buildable today?**: Yes -- fully buildable. This is a uniquely powerful workflow because it chains `get-transaction` -> `decode-calldata` -> `assess-risk` to provide human-readable, risk-scored transaction summaries.
**Value proposition**: No other tool provides real-time decoded + risk-assessed Safe transaction monitoring as a no-code workflow.

---

### Workflow 6: Safe Treasury Balance Watcher + Auto-Refill

**The gap**: Safe wallets used as operational wallets (paying gas, funding keepers) run out of ETH with no warning. Manual checking is the only option.
**The idea**: Scheduled monitoring of ETH and key token balances, with alerts on low thresholds and optional auto-refill from a hot wallet
**Value**: Prevent operational disruption from empty operational Safes

**Trigger**: Schedule -- `0 */4 * * *` (every 4 hours)
(EXISTING)

**Nodes**:
1. Check Balance -- ETH balance of Safe address (EXISTING: `web3/check-balance`)
2. Check Token Balance -- USDC balance of Safe address (EXISTING: `web3/check-token-balance`)
3. Condition -- ETH balance < 0.5 (EXISTING: `Condition`)
4. Discord -- "Low ETH in operational Safe" (EXISTING: `discord/send-message`)
5. Transfer Funds -- Auto-refill ETH from hot wallet (EXISTING: `web3/transfer-funds`, requires wallet integration)

**Flow**:
```
[Schedule: every 4h] -> [Check ETH Balance] -> [Condition: < 0.5 ETH] -> [Discord Alert]
                                                                        -> [Transfer 1 ETH from hot wallet]
                     -> [Check USDC Balance] -> [Condition: < 1000 USDC] -> [Discord Alert]
```

**Buildable today?**: Yes for monitoring + alerting. Auto-refill requires the KeeperHub wallet to hold funds and have a wallet integration configured.
**Value proposition**: Standard watcher/filler pattern applied to Safe wallets. Prevents operational downtime.

---

### Workflow 7: Safe Transaction Queue Monitor

**The gap**: When a transaction is proposed in the Safe queue, owners must manually check the Safe{Wallet} UI to discover it. There are no push notifications. Stale proposals sit unsigned for days.
**The idea**: Poll the Safe Transaction Service API for pending transactions, alert owners when new proposals appear, and warn when proposals go stale
**Value**: Reduce signature collection time from days to hours by proactively notifying signers

**Trigger**: Schedule -- `*/10 * * * *` (every 10 minutes)
(EXISTING)

**Nodes**:
1. HTTP Request -- GET `https://safe-transaction-mainnet.safe.global/api/v1/safes/{address}/multisig-transactions/?executed=false` (EXISTING: `HTTP Request`)
2. Condition -- Check if pending transactions exist (EXISTING: `Condition`)
3. For Each -- Loop over pending transactions (EXISTING: `For Each`)
4. Discord -- Alert per pending tx: "Pending Safe tx: nonce {nonce}, {confirmations}/{threshold} signatures collected" (EXISTING: `discord/send-message`)
5. Collect -- Aggregate results (EXISTING: `Collect`)

**Flow**:
```
[Schedule: 10min] -> [HTTP: Safe TX Service API] -> [Condition: has pending?] -> [For Each: pending txs]
                                                                                   -> [Discord: "Pending tx needs signatures"]
                                                                                -> [Collect]
```

**Buildable today?**: Yes -- HTTP Request queries the Safe Transaction Service REST API. Database Query provides state persistence across runs (track already-notified proposals to avoid duplicate alerts).
**Value proposition**: This solves the #1 operational pain point for Safe users: "I didn't know there was a transaction waiting for my signature."

---

### Workflow 8: Nonce Gap / Stuck Queue Detector

**The gap**: Safe transactions must execute in nonce order. A stuck transaction (one that can no longer execute) blocks the entire queue. Teams discover this only when later transactions fail. No detection mechanism exists.
**The idea**: Periodically read the on-chain nonce, compare to the TX Service queue, and alert when the nonce hasn't advanced despite pending transactions
**Value**: Detect stuck queues before they cause operational disruption

**Trigger**: Schedule -- `0 * * * *` (every hour)
(EXISTING)

**Nodes**:
1. Read Contract -- `nonce()` on Safe proxy (EXISTING: `web3/read-contract`)
2. HTTP Request -- GET pending transactions from Safe TX Service (EXISTING: `HTTP Request`)
3. Database Query -- Read last-seen nonce from persistent store (EXISTING: `Database Query`)
4. Condition -- Nonce unchanged AND pending txs exist (EXISTING: `Condition`)
5. Discord -- "WARNING: Safe nonce stuck at {nonce}. {count} pending txs waiting." (EXISTING: `discord/send-message`)
6. Database Query -- Write current nonce for next comparison (EXISTING: `Database Query`)

**Flow**:
```
[Schedule: 1h] -> [Read nonce()] ---------> [Condition: nonce unchanged + pending txs?] -> [Discord: Stuck!]
               -> [HTTP: pending txs] ---/
               -> [DB: read last nonce] /
                                         -> [DB: write current nonce]
```

**Buildable today?**: Yes -- Database Query node provides state persistence across runs (store/compare last-seen nonce). Combined with HTTP Request to the TX Service and on-chain nonce read, this workflow is fully buildable.
**Value proposition**: Stuck nonces are a silent operational killer for Safe-heavy operations. Early detection saves hours of debugging.

---

### Workflow 9: ETH/Token Received Alert

**The gap**: No notification when a Safe receives funds. Teams discover deposits by manually checking the UI.
**The idea**: Real-time alert when ETH is received, with sender address and amount
**Value**: Immediate visibility into incoming funds for treasury management and accounting

**Trigger**: Event -- `SafeReceived(address indexed sender, uint256 value)` on Safe proxy
(EXISTING)

**Nodes**:
1. Discord -- "Safe received {value} wei from {sender}" (EXISTING: `discord/send-message`)
2. Slack -- Treasury channel notification (EXISTING: `slack/send-message`)

**Flow**:
```
[Event: SafeReceived] -> [Discord: "{value} ETH received from {sender}"]
                       -> [Slack: Treasury channel]
```

**Buildable today?**: Yes for native ETH. For ERC20 tokens, requires monitoring `Transfer` events on each token contract individually (one workflow per token).
**Value proposition**: Basic treasury visibility. Every finance team needs this.

---

### Workflow 10: On-Chain Signature (ApproveHash) Tracker

**The gap**: Some owners use on-chain `approveHash` instead of off-chain signing. These on-chain approvals are visible only by scanning events -- the Safe UI does not prominently surface them.
**The idea**: Alert when any owner pre-approves a transaction hash on-chain
**Value**: Visibility into the on-chain signing process, useful for compliance and audit trails

**Trigger**: Event -- `ApproveHash(bytes32 indexed approvedHash, address indexed owner)` on Safe proxy
(EXISTING)

**Nodes**:
1. Discord -- "Owner {owner} approved hash {approvedHash} on-chain. Tx: {transactionHash}" (EXISTING: `discord/send-message`)

**Flow**:
```
[Event: ApproveHash] -> [Discord: "Owner {owner} approved hash on-chain"]
```

**Buildable today?**: Yes -- fully buildable.
**Value proposition**: Compliance and audit trail for on-chain approval activity.

---

### Workflow 11: Safe DeFi Position Health Monitor

**The gap**: Safe wallets holding DeFi positions (Aave lending, Compound borrowing) have no automated health factor monitoring. Teams manually check positions.
**The idea**: Scheduled read of Aave/Compound user account data for the Safe address, with alerts when health factors approach liquidation
**Value**: Prevent liquidation of DeFi positions held in protocol treasuries

**Trigger**: Schedule -- `*/10 * * * *` (every 10 minutes)
(EXISTING)

**Nodes**:
1. Read Contract -- Aave Pool `getUserAccountData(safeAddress)` returns health factor (EXISTING: `web3/read-contract`)
2. Condition -- `healthFactor < 1500000000000000000` (1.5 with 18 decimals) (EXISTING: `Condition` -- note: string comparison of uint256 is a known limitation)
3. Discord -- "WARNING: Safe Aave position health factor critical" (EXISTING: `discord/send-message`)
4. SendGrid -- Alert treasury managers (EXISTING: `sendgrid/send-email`)

**Flow**:
```
[Schedule: 10min] -> [Read getUserAccountData()] -> [Condition: healthFactor < 1.5] -> [Discord Alert]
                                                                                     -> [Email Alert]
```

**Buildable today?**: Partially -- the read-contract call works. Comparing health factor (uint256 with 18 decimals) in a Condition node requires numeric parsing of large numbers. String comparison may produce incorrect results for numeric values.
**Value proposition**: Prevent multi-million dollar liquidations in protocol treasuries.

---

### Workflow 12: Module Transaction Auditor (L2)

**The gap**: Modules can execute arbitrary transactions through a Safe without signatures. On L2 chains, SafeL2 emits `SafeModuleTransaction` events for these, but no monitoring exists.
**The idea**: Monitor all module-executed transactions, decode the calldata, assess risk, and alert on suspicious operations
**Value**: Audit trail and real-time alerting for all module-bypassed operations

**Trigger**: Event -- `SafeModuleTransaction(address module, address to, uint256 value, bytes data, uint8 operation)` on SafeL2 proxy
(EXISTING -- L2 chains only)

**Nodes**:
1. Decode Calldata -- Decode what the module transaction did (EXISTING: `web3/decode-calldata`)
2. Assess Risk -- AI-powered risk assessment (EXISTING: `web3/assess-risk`)
3. Condition -- `riskLevel == "high" || riskLevel == "critical"` (EXISTING: `Condition`)
4. Discord -- Decoded details + risk assessment for high-risk operations (EXISTING: `discord/send-message`)
5. Webhook -- POST to SIEM/incident management for critical risk (EXISTING: `webhook/send-webhook`)

**Flow**:
```
[Event: SafeModuleTransaction] -> [Decode Calldata] -> [Assess Risk] -> [Condition: high/critical?]
                                                                          -> [Discord: Decoded alert]
                                                                          -> [Webhook: SIEM]
```

**Buildable today?**: Yes on L2 chains (Base, Arbitrum, etc.). On L1 Ethereum with v1.3.0 Safes, this event is not emitted -- module transactions can only be detected through transaction-level analysis.
**Value proposition**: Module transactions bypass the core security model (signatures). Auditing them is essential.

---

## 4. Buildable Today

| # | Workflow | Status | Capabilities Used |
|---|----------|--------|-------------------|
| 1 | Owner Change Alert | FULLY BUILDABLE | Event trigger, Read Contract, Discord, SendGrid |
| 2 | Module Installation Alert | FULLY BUILDABLE | Event trigger, Read Contract, Discord, SendGrid, Webhook |
| 3 | Threshold Change Alert | FULLY BUILDABLE | Event trigger, Read Contract, Discord, SendGrid |
| 4 | Guard Change Alert | FULLY BUILDABLE | Event trigger, Condition, Discord, Webhook |
| 5 | Transaction Execution Monitor | FULLY BUILDABLE | Event trigger, Get Transaction, Decode Calldata, Assess Risk, Discord |
| 6 | Treasury Balance Watcher | FULLY BUILDABLE | Schedule, Check Balance, Check Token Balance, Condition, Discord, Transfer |
| 7 | Transaction Queue Monitor | FULLY BUILDABLE | Schedule, HTTP Request, For Each, Condition, Discord, Database Query |
| 8 | Nonce Gap Detector | FULLY BUILDABLE | Schedule, Read Contract, HTTP Request, Database Query (state across runs) |
| 9 | ETH Received Alert | FULLY BUILDABLE | Event trigger, Discord, Slack |
| 10 | ApproveHash Tracker | FULLY BUILDABLE | Event trigger, Discord |
| 11 | DeFi Position Health Monitor | PARTIALLY BUILDABLE | Schedule, Read Contract, Condition (uint256 comparison gap) |
| 12 | Module Transaction Auditor | BUILDABLE ON L2 ONLY | Event trigger, Decode Calldata, Assess Risk, Condition, Discord |

**Summary**: 10 of 12 workflows are fully buildable today. 2 have partial gaps (numeric comparison for uint256, L1 event limitations).

---

## 5. New Plugin / Node Type Proposals

### 5.1 Safe Transaction Service Plugin (HIGH PRIORITY)

**Plugin name**: `safe` (category: web3)
**What it does**: Native integration with the Safe Transaction Service API
**Why first-class**: The TX Service is the primary data source for Safe operations. Raw HTTP Request works but requires users to know the API schema, parse responses, and handle pagination.

**Proposed actions**:

| Action | Input | Output | Unlocks |
|--------|-------|--------|---------|
| `safe/get-pending-transactions` | `safeAddress`, `network` | Array of pending txs with nonce, confirmations count, threshold | Workflows 7, 8 |
| `safe/get-safe-info` | `safeAddress`, `network` | owners, threshold, nonce, modules, guard, version, fallbackHandler | All monitoring workflows (richer context) |
| `safe/get-transaction-confirmations` | `safeAddress`, `safeTxHash` | Array of confirmation objects with owner addresses and signature data | Signature tracking workflows |
| `safe/get-incoming-transfers` | `safeAddress`, `network` | Array of incoming token transfers | ERC20 received alert (covers the token gap in Workflow 9) |

### 5.2 Multi-Event Trigger (MEDIUM PRIORITY)

**What it does**: Listen for multiple event types on the same contract address in one trigger
**Why**: Monitoring a single Safe for owner changes, module changes, threshold changes, and guard changes currently requires 4+ separate workflows. With a multi-event trigger, one "Safe Security Bundle" workflow handles them all.
**Unlocks**: Single "Safe Security Monitor" workflow instead of 4-6 separate workflows

### 5.3 BigNumber-Aware Condition Evaluation (MEDIUM PRIORITY)

**What it does**: Parse and compare numeric strings as BigNumber values in Condition expressions
**Why**: uint256 values from read-contract come as strings. Comparing `"1500000000000000000" < "2000000000000000000"` works alphabetically but fails for values like `"9" < "10"`. This is a platform-wide issue affecting all DeFi monitoring workflows.
**Unlocks**: Workflow 11 (health factor comparison) and any workflow comparing on-chain numeric values

---

## 6. Priority Ranking

| Rank | Workflow | Impact | Buildable | Why This Priority |
|------|----------|--------|-----------|-------------------|
| 1 | Module Installation Alert (#2) | CRITICAL | Today | Most dangerous attack vector -- zero existing monitoring |
| 2 | Owner Change Alert (#1) | CRITICAL | Today | Second most common attack step |
| 3 | Transaction Execution Monitor (#5) | HIGH | Today | Unique value: decoded + risk-assessed tx summaries |
| 4 | Threshold Change Alert (#3) | HIGH | Today | Completes the security monitoring bundle |
| 5 | Guard Change Alert (#4) | HIGH | Today | Completes the security monitoring bundle |
| 6 | Transaction Queue Monitor (#7) | HIGH | Mostly | Solves the #1 operational pain point (stale proposals) |
| 7 | Treasury Balance Watcher (#6) | MEDIUM | Today | Standard pattern, high utility |
| 8 | Module Transaction Auditor (#12) | MEDIUM | L2 only | Audits the most privileged operations |
| 9 | DeFi Position Health Monitor (#11) | MEDIUM | Partial | High-value but blocked by numeric comparison gap |
| 10 | ETH Received Alert (#9) | MEDIUM | Today | Basic treasury visibility |
| 11 | Nonce Gap Detector (#8) | MEDIUM | Today | Database Query provides state persistence |
| 12 | ApproveHash Tracker (#10) | LOW | Today | Compliance/audit niche |

### Highest-Leverage New Capability

**Safe Transaction Service Plugin** -- unlocks the most valuable workflows that are not event-based. The TX Service is the primary data source for Safe operational state (pending transactions, signature counts, queue depth). Building a native plugin eliminates the need for users to construct raw HTTP Request nodes with correct URLs, headers, and response parsing.

---

## 7. Competitive Moat

### Why these workflows are hard to replicate

1. **Decode + Assess Risk pipeline**: KeeperHub's `get-transaction` -> `decode-calldata` -> `assess-risk` chain provides human-readable, AI-risk-scored transaction summaries. No other no-code tool offers this for Safe monitoring. Competitors would need to build the calldata decoding engine and AI risk model from scratch.

2. **Event-to-action in a single platform**: Safe security monitoring currently requires stitching together multiple tools (Tenderly for event monitoring, Defender for alerts, PagerDuty for routing). KeeperHub does trigger -> enrich -> alert in one workflow.

3. **Multi-channel routing**: A single workflow can fan out to Discord, Slack, Telegram, Email, and webhooks simultaneously. Competitors typically support one or two channels.

4. **Module transaction auditing**: The combination of event trigger + calldata decode + risk assessment for module transactions is unique. This is the gap between "we saw an event" and "we understand what the module did and whether it's dangerous."

5. **Path to execution**: With the Zodiac Roles Modifier, a KeeperHub wallet can be granted scoped permissions to execute specific operations through the Safe. This positions KeeperHub as not just a monitoring tool but an execution layer for Safe-based protocol operations -- the same value proposition that makes KeeperHub critical for Sky Protocol.

### Target Audience

- **DAO treasuries** ($10M+) using Safe for fund management -- need security monitoring as a minimum
- **Protocol operations teams** using Safe for deploying upgrades, managing parameters -- need queue monitoring and execution tracking
- **DeFi protocols** using Safe to hold treasury positions -- need health factor monitoring
- **Multi-chain protocols** with Safes on 3+ chains -- need cross-chain configuration monitoring

### Go-to-Market Bundle

**"Safe Security Monitor"** -- a template bundle of 5 workflows (Workflows 1-5) that can be deployed in minutes:
1. Owner Change Alert
2. Module Installation Alert
3. Threshold Change Alert
4. Guard Change Alert
5. Transaction Execution Monitor with Decoded Context

This bundle addresses the most critical security gap in the Safe ecosystem and requires only a Safe proxy address to set up. It's the ideal entry point for converting Safe users into KeeperHub customers.
