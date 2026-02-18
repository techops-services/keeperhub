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
| Batch Read Contract | Web3 | No | Batch multiple contract reads into one RPC call via Multicall3 |
| Get Transaction | Web3 | No | Fetch full transaction details by hash |
| Write Contract | Web3 | Wallet | Execute state-changing contract functions |
| Transfer Native Token | Web3 | Wallet | Send ETH/MATIC/etc. to a recipient |
| Transfer ERC20 Token | Web3 | Wallet | Send ERC20 tokens to a recipient |
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

## Batch Read Contract

Call the same contract function with multiple argument sets -- or different functions across different contracts -- in a single RPC call using Multicall3. Reduces dozens of individual read-contract nodes into one.

No credentials required -- this is a read-only operation using Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`.

### Input Modes

| Mode    | Description                                                                 | Best For                                                              |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Uniform | One contract, one function, array of argument sets on a single network      | Same function across many inputs: `balanceOf(addr)` for 50 pools      |
| Mixed   | Each call has its own network, contract address, ABI, function, and args    | Heterogeneous reads: `hat()` + `approvals(addr)` on different chains  |

### Inputs

**Uniform Mode:**

| Input           | Required | Description                                                                              |
| --------------- | -------- | ---------------------------------------------------------------------------------------- |
| inputMode       | Yes      | `uniform` (default) or `mixed`                                                           |
| network         | Yes      | EVM chain to execute on                                                                  |
| contractAddress | Yes      | Target contract address (`0x...` or template variable)                                   |
| abi             | Yes      | Contract ABI (auto-fetched from block explorer or pasted manually)                       |
| abiFunction     | Yes      | Function to call (selected from ABI)                                                     |
| argsList        | No       | JSON array of argument arrays. Each inner array is the args for one call                 |
| batchSize       | No       | Max calls per Multicall3 request (default: 100, range: 1-500)                            |

**Mixed Mode:**

| Input     | Required | Description                                                                                    |
| --------- | -------- | ---------------------------------------------------------------------------------------------- |
| inputMode | Yes      | Must be `mixed`                                                                                |
| calls     | Yes      | List of call objects, each with its own network, contract address, ABI, function, and arguments |
| batchSize | No       | Max calls per Multicall3 request per network (default: 100, range: 1-500)                      |

Each call in mixed mode is fully self-contained with:
- **Network** -- can mix calls across different chains (grouped and batched per network)
- **Contract Address** -- with address book integration for saved addresses
- **ABI** -- auto-fetched from block explorer per contract
- **Function** -- selected from the contract's ABI
- **Arguments** -- auto-populated input fields based on function signature

### Outputs

| Output     | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| success    | Whether the batch operation succeeded overall                                |
| results    | Array of `{ success, result, error? }` in original call order                |
| totalCalls | Total number of calls executed                                               |
| error      | Error message if the entire batch failed (validation, RPC, or encoding error)|

Each entry in `results` has:
- `success` -- whether this specific call succeeded
- `result` -- decoded return value (structured with named fields when ABI provides output names)
- `error` -- revert reason if the call failed (decoded from revert data when possible)

### Partial Failure Handling

Uses Multicall3's `aggregate3` with `allowFailure: true`. If one call reverts, the others still return successfully. Each result has its own `success` flag. Revert reasons are decoded when possible (custom errors, `Error(string)` pattern, or raw bytes).

### Cross-Chain Execution (Mixed Mode)

When mixed mode calls target different networks, calls are automatically grouped by network. Each network group is executed as a separate Multicall3 call, and results are merged back in the original call order. This means you can batch reads across Ethereum, Polygon, and Arbitrum in a single node.

### Batch Size

The `batchSize` parameter (default: 100) controls how many calls are included in each Multicall3 RPC request. If you have 250 calls with a batch size of 100, the node sends 3 sequential RPC requests (100 + 100 + 50). Lower values reduce payload size and are useful when RPC providers have response size limits.

### Result Structure

Return values are structured based on ABI output definitions:

- **Single unnamed output**: Returns the value directly (e.g., `"1000000000000000000"`)
- **Single named output**: Returns `{ outputName: value }` (e.g., `{ "balance": "1000000000000000000" }`)
- **Multiple outputs**: Returns an object with all named fields (e.g., `{ "reserve0": "...", "reserve1": "...", "blockTimestamp": "..." }`)
- **BigInt values**: Serialized as strings to preserve precision

---

## Example Workflows

### DEX Pool Liquidity Monitor (Uniform Mode)

Monitor a token's balance across multiple DEX pool contracts. One function (`balanceOf`), many addresses.

```
Schedule (every 5 min)
  -> Batch Read Contract:
       inputMode: uniform
       network: ethereum
       contractAddress: 0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2 (MKR)
       function: balanceOf(address)
       argsList: [
         ["0xPool1"],
         ["0xPool2"],
         ["0xPool3"],
         ...
         ["0xPool14"]
       ]
  -> Aggregate:
       operation: sum
       inputMode: array
       arrayInput: {{@batch:Batch Read Contract.results}}
       fieldPath: result.balance
  -> Condition: {{@total:Aggregate.result}} < 1000000000000000000000
  -> Discord: "Low MKR liquidity: {{@total:Aggregate.result}} across {{@batch:Batch Read Contract.totalCalls}} pools"
```

### Multi-Contract Governance Dashboard (Mixed Mode)

Read different parameters from multiple governance contracts on the same chain.

```
Schedule (every hour)
  -> Batch Read Contract:
       inputMode: mixed
       calls: [
         { network: "ethereum", contractAddress: "0xGovA", abiFunction: "hat", args: [] },
         { network: "ethereum", contractAddress: "0xGovA", abiFunction: "approvals", args: ["0xSpell1"] },
         { network: "ethereum", contractAddress: "0xGovB", abiFunction: "proposalCount", args: [] },
         { network: "ethereum", contractAddress: "0xGovB", abiFunction: "state", args: [42] }
       ]
  -> Discord: "hat={{@batch.results[0].result}}, approvals={{@batch.results[1].result}}, proposals={{@batch.results[2].result}}"
```

### Cross-Chain Balance Check (Mixed Mode)

Check the same token's balance on multiple chains in a single node.

```
Schedule (every 15 min)
  -> Batch Read Contract:
       inputMode: mixed
       calls: [
         { network: "ethereum", contractAddress: "0xUSDC_ETH", abiFunction: "balanceOf", args: ["0xTreasury"], abi: "..." },
         { network: "polygon", contractAddress: "0xUSDC_POLY", abiFunction: "balanceOf", args: ["0xTreasury"], abi: "..." },
         { network: "arbitrum", contractAddress: "0xUSDC_ARB", abiFunction: "balanceOf", args: ["0xTreasury"], abi: "..." }
       ]
  -> Aggregate:
       operation: sum
       inputMode: array
       arrayInput: {{@batch:Batch Read Contract.results}}
       fieldPath: result
  -> Discord: "Total USDC across 3 chains: {{@total:Aggregate.result}}"
```

### Keeper Network Job Scanner (Uniform Mode)

Check which jobs are workable across a keeper network using a single batched read.

```
Schedule (every block)
  -> Batch Read Contract:
       inputMode: uniform
       network: ethereum
       contractAddress: 0xKeeperRegistry
       function: workable(address)
       argsList: [
         ["0xJob1"],
         ["0xJob2"],
         ["0xJob3"],
         ["0xJob4"]
       ]
  -> Condition: any result.success && result.result == true
  -> Write Contract: execute the workable job
```

### Uniswap V2 Pair Reserves (Uniform Mode)

Read reserves from multiple Uniswap V2 pairs to compute prices. Each `getReserves()` returns `(reserve0, reserve1, blockTimestampLast)`.

```
Schedule (every 5 min)
  -> Batch Read Contract:
       inputMode: uniform
       network: ethereum
       contractAddress: 0xPairFactory
       function: getReserves()
       argsList: []  (no args needed)
  -> Discord: "Pair reserves: {{@batch:Batch Read Contract.results}}"
```

### Loop + Batch Read (Dynamic Address List)

Use a database query to get a dynamic list of addresses, then batch-read their balances.

```
Schedule (daily)
  -> Database Query: SELECT address FROM monitored_wallets
  -> Batch Read Contract:
       inputMode: uniform
       network: ethereum
       contractAddress: 0xUSDC
       function: balanceOf(address)
       argsList: {{@db:Database Query.rows | map to [["addr1"], ["addr2"], ...]}}
  -> Aggregate:
       operation: sum
       inputMode: array
       arrayInput: {{@batch:Batch Read Contract.results}}
       fieldPath: result
  -> Discord: "Total USDC across {{@batch:Batch Read Contract.totalCalls}} wallets: {{@total:Aggregate.result}}"
```

### Partial Failure Detection

Handle calls where some succeed and some revert, such as checking allowances on contracts that may not implement the interface.

```
Schedule (every hour)
  -> Batch Read Contract:
       inputMode: mixed
       calls: [
         { network: "ethereum", contractAddress: "0xTokenA", abiFunction: "allowance", args: ["0xOwner", "0xSpender"], abi: "..." },
         { network: "ethereum", contractAddress: "0xTokenB", abiFunction: "allowance", args: ["0xOwner", "0xSpender"], abi: "..." },
         { network: "ethereum", contractAddress: "0xNonERC20", abiFunction: "allowance", args: ["0xOwner", "0xSpender"], abi: "..." }
       ]
  -> Condition: any result where success == false
  -> Discord: "Failed calls: {{failed results with error messages}}"
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
