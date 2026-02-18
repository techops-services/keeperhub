---
title: "Web3 Plugin"
description: "Blockchain operations including balance checks, contract interactions, transfers, calldata decoding, and AI-powered risk assessment."
---

# Web3 Plugin

Interact with EVM-compatible blockchain networks. Read-only actions work without credentials. Write actions require a connected Para wallet.

## Actions

| Action | Category | Credentials | Description |
|--------|----------|-------------|-------------|
| Get Native Token Balance | Web3 | No | Check ETH/MATIC/etc. balance of any address |
| Get ERC20 Token Balance | Web3 | No | Check token balance of any address |
| Read Contract | Web3 | No | Call view/pure functions on smart contracts |
| Get Transaction | Web3 | No | Fetch full transaction details by hash |
| Write Contract | Web3 | Wallet | Execute state-changing contract functions |
| Transfer Native Token | Web3 | Wallet | Send ETH/MATIC/etc. to a recipient |
| Transfer ERC20 Token | Web3 | Wallet | Send ERC20 tokens to a recipient |
| Query Contract Events | Web3 | No | Query historical smart contract events across a block range |
| Decode Calldata | Security | No | Decode raw calldata into human-readable function calls |
| Assess Transaction Risk | Security | No | AI-powered risk scoring with built-in DeFi rules |

---

## Get Native Token Balance

Check the native token balance (ETH, MATIC, etc.) of any address on any supported EVM chain.

**Inputs:** Network, Address

**Outputs:** `success`, `balance` (human-readable), `balanceWei`, `address`, `error`

**When to use:** Monitor wallet balances, trigger refills when balance drops below a threshold, track treasury holdings.

**Example workflow:**
```
Schedule (every hour)
  -> Get Native Token Balance (bot wallet)
  -> Condition: balance < 0.1 ETH
  -> Transfer Native Token (refill from treasury)
  -> Discord: "Bot wallet refilled"
```

---

## Get ERC20 Token Balance

Check the balance of any ERC20 token for a given address.

**Inputs:** Network, Address, Token (select from supported tokens or enter custom contract)

**Outputs:** `success`, `balance.balance`, `balance.symbol`, `balance.decimals`, `balance.name`, `address`, `error`

**When to use:** Track token holdings, monitor protocol positions, alert on balance changes.

---

## Read Contract

Call view or pure functions on any verified smart contract. Automatically fetches the ABI from block explorers and supports proxy contracts.

**Inputs:** Network, Contract Address, ABI (auto-fetched), Function, Function Arguments

**Outputs:** `success`, `result` (structured based on ABI outputs), `error`

**When to use:** Read on-chain state (prices, positions, governance proposals), check protocol health factors, monitor contract parameters.

**Example workflow:**
```
Schedule (every 5 min)
  -> Read Contract: Aave getLiquidationThreshold()
  -> Condition: health factor < 1.5
  -> Discord: "Liquidation risk alert"
```

---

## Get Transaction

Fetch full transaction details by hash via `eth_getTransactionByHash`. Returns sender, recipient, value, calldata, nonce, gas, and block explorer links.

**Inputs:** Network, Transaction Hash

**Outputs:** `success`, `hash`, `from`, `to`, `value` (ETH), `input` (calldata), `nonce`, `gasLimit`, `blockNumber`, `transactionLink`, `fromLink`, `toLink`, `error`

**When to use:** Enrich event-triggered workflows with full transaction context, inspect pending transactions, feed transaction data into Decode Calldata or Assess Risk steps.

**Example workflow:**
```
Event (new transaction on monitored contract)
  -> Get Transaction: {{Trigger.transactionHash}}
  -> Decode Calldata: {{GetTransaction.input}}
  -> Assess Transaction Risk: calldata={{GetTransaction.input}}, value={{GetTransaction.value}}
  -> Condition: riskScore >= 51
  -> Discord: "HIGH RISK TX from {{GetTransaction.from}}: {{AssessRisk.reasoning}}"
```

---

## Query Contract Events

Query historical smart contract events (logs) across a block range with automatic batching. Supports any EVM-compatible chain. The step internally batches queries in 2,000-block chunks to stay within RPC provider limits.

**Inputs:**
- Network (required)
- Contract Address (required)
- Contract ABI (required, auto-fetched from block explorer)
- Event Name (required, selected from ABI)
- Block Lookback -- number of blocks to scan back from To Block (default: 6500, ~1 day on Ethereum). Ignored if From Block is set
- From Block -- explicit start block (overrides Block Lookback)
- To Block -- end block number (default: latest)

**Outputs:** `success`, `events` (array of decoded event objects with `blockNumber`, `transactionHash`, `logIndex`, `args`), `fromBlock`, `toBlock`, `eventCount`, `error`

**How it works:**

1. Resolves the block range from inputs (either explicit From/To or lookback from latest)
2. Splits the range into 2,000-block batches to avoid RPC provider limits
3. Queries each batch via `eth_getLogs` and decodes events using the ABI
4. Concatenates all results and returns the full event list

**When to use:** Index historical events, monitor contract activity over time, aggregate on-chain data for analytics, trigger downstream actions based on past events.

**Example workflow -- DEX Swap Monitor:**
```
Schedule (every hour)
  -> Query Contract Events: Uniswap Router, event "Swap", blockCount 300
  -> Condition: eventCount > 0
  -> Discord: "{{QueryEvents.eventCount}} swaps in the last hour"
```

**Example workflow -- Governance Vote Tracker:**
```
Schedule (daily)
  -> Query Contract Events: Governor contract, event "VoteCast", blockCount 7200
  -> SendGrid: "{{QueryEvents.eventCount}} votes cast today"
```

---

## Write Contract

Execute state-changing functions on smart contracts using your Para wallet. Requires a connected wallet.

**Inputs:** Network, Contract Address, ABI (auto-fetched), Function, Function Arguments, Gas Limit Multiplier (optional, in Advanced section)

**Outputs:** `success`, `transactionHash`, `result`, `error`

**When to use:** Execute DeFi operations (harvest, compound, rebalance), respond to on-chain events, automate protocol maintenance.

**Gas Configuration:** Optionally set a custom Gas Limit Multiplier in the Advanced section to override the chain default. See [Gas Management](/wallet-management/gas) for details.

---

## Transfer Native Token

Send ETH, MATIC, or other native tokens from your Para wallet to a recipient address.

**Inputs:** Network, Amount (ETH), Recipient Address, Gas Limit Multiplier (optional, in Advanced section)

**Outputs:** `success`, `transactionHash`, `error`

**When to use:** Refill bot wallets, distribute funds, automate payroll.

**Gas Configuration:** Optionally set a custom Gas Limit Multiplier in the Advanced section to override the chain default. See [Gas Management](/wallet-management/gas) for details.

---

## Transfer ERC20 Token

Send ERC20 tokens from your Para wallet to a recipient address.

**Inputs:** Network, Token, Amount, Recipient Address, Gas Limit Multiplier (optional, in Advanced section)

**Outputs:** `success`, `transactionHash`, `transactionLink`, `amount`, `symbol`, `recipient`, `error`

**When to use:** Distribute tokens, move funds between wallets, automate token transfers based on conditions.

**Gas Configuration:** Optionally set a custom Gas Limit Multiplier in the Advanced section to override the chain default. See [Gas Management](/wallet-management/gas) for details.

---

## Decode Calldata

Decode raw transaction calldata into human-readable function calls with parameter names and values. Uses a cascading strategy: manual ABI, block explorer lookup, 4byte.directory, then selector-only fallback.

**Inputs:** Calldata (hex string), Contract Address (optional), Network (optional), ABI Override (optional, advanced)

**Outputs:** `success`, `selector`, `functionName`, `functionSignature`, `parameters` (array with name/type/value), `decodingSource`, `error`

**When to use:** Analyze pending transactions before execution, audit governance proposals, inspect multisig queue items, feed decoded data into risk assessment.

This is a security-critical action (`maxRetries = 0`). On error, it fails rather than retrying.

**Example workflow:**
```
Webhook (receives pending tx)
  -> Decode Calldata: {{Trigger.calldata}}
  -> Condition: functionName == "transferOwnership"
  -> Discord: "ALERT: Ownership transfer detected"
```

---

## Assess Transaction Risk

AI-powered risk assessment that combines built-in DeFi security rules with OpenAI analysis. Produces a risk score (0-100) and detailed risk factors.

**Inputs:** Transaction Calldata, Contract Address (optional), Transaction Value in ETH (optional), Chain (optional), Sender Address (optional)

**Outputs:** `success`, `riskLevel` (low/medium/high/critical), `riskScore` (0-100), `factors` (array of risk descriptions), `decodedFunction`, `reasoning`, `error`

**How it works:**

1. Auto-decodes calldata internally (no need for a separate Decode Calldata step)
2. Runs built-in rules across 4 categories:
   - **Approval risks** -- Unlimited approvals (MAX_UINT256), setApprovalForAll
   - **Privileged operations** -- transferOwnership, upgradeTo, selfdestruct
   - **Value risks** -- Large ETH transfers (>10 ETH)
   - **Interaction risks** -- Zero address targets, unknown selectors, generic execution patterns
3. Critical rule match short-circuits without AI call
4. Otherwise, enhances assessment with GPT-4o Mini (3s timeout)
5. Combines rule-based and AI findings, taking the higher risk level

**Fail-closed policy:** If the AI call fails or times out, the risk level is elevated (not lowered). This is a security-critical action (`maxRetries = 0`).

**When to use:** Guard transactions before execution, score governance proposals, audit multisig queues, build security monitoring workflows.

**Example workflow -- Transaction Guardian:**
```
Webhook (receives pending tx from multisig)
  -> Assess Transaction Risk: {{Trigger.calldata}}
  -> Condition: riskLevel == "critical" OR riskLevel == "high"
    -> YES: Discord #security-alerts: "HIGH RISK TX: {{AssessRisk.reasoning}}"
    -> NO: Discord #operations: "TX approved ({{AssessRisk.riskLevel}})"
```

**Example workflow -- Approval Monitor:**
```
Schedule (every 15 min)
  -> Read Contract: getApprovalQueue()
  -> Assess Transaction Risk: {{ReadContract.result.calldata}}
  -> Condition: riskScore > 50
  -> SendGrid: "Review required: risk score {{AssessRisk.riskScore}}"
```
