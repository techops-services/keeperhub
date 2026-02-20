---
title: "Safe Plugin"
description: "Monitor pending Safe multisig transactions and verify them before signing."
---

# Safe Plugin

Fetch pending transactions from Safe (formerly Gnosis Safe) multisig wallets. Use with existing Web3 decode and risk assessment actions to verify transactions before signing -- preventing attacks like the Bybit hack where malicious calldata was substituted into a legitimate-looking transaction.

## Actions

| Action | Description |
|--------|-------------|
| Get Pending Transactions | Fetch unexecuted multisig transactions from a Safe, optionally filtered by signer |

## Setup

1. Go to [developer.safe.global](https://developer.safe.global/) and create an API project
2. Copy the JWT API key
3. In KeeperHub, go to **Connections > Add Connection > Safe**
4. Paste the API key and save

## Get Pending Transactions

Fetch pending multisig transactions that have not been executed yet. Optionally filter for transactions a specific signer has not confirmed.

**Inputs:** Safe Address, Network, Signer Address (optional -- filters for txs this address has not signed)

**Outputs:** `success`, `transactions` (array), `count`, `error`

Each transaction includes: `safeTxHash`, `to`, `value`, `data`, `operation` (0=CALL, 1=DELEGATECALL), `operationLabel`, `nonce`, `confirmations`, `confirmationsRequired`, `confirmationsCollected`, `dataDecoded`, `submissionDate`, `safe`

**When to use:** Monitor your Safe for new transactions awaiting your signature, verify transaction calldata before signing, detect suspicious proposals (DELEGATECALL, proxy upgrades, unknown targets).

**Supported networks:** Ethereum, Arbitrum, Optimism, Polygon, Base, BSC, Avalanche, Gnosis, Sepolia, Base Sepolia

**Example workflow:**
```
Schedule (every 5 min)
  -> Safe: Get Pending Transactions (signer = your address)
  -> For Each: pending transaction
    -> Decode Calldata: {{GetPendingTransactions.transactions.data}}
    -> Assess Transaction Risk: decoded calldata + context
    -> Condition: operation == 1 (DELEGATECALL) OR riskScore > 70
    -> Discord: "Suspicious Safe tx: {{DecodeCalldata.functionName}} on {{GetPendingTransactions.transactions.to}}"
```
