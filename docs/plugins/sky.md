---
title: "Sky Protocol"
description: "USDS savings (sUSDS), token balances, approvals, and DAI/MKR migration converters on Ethereum, Base, and Arbitrum."
---

# Sky Protocol

Sky (formerly MakerDAO) is a decentralized protocol for stablecoin savings, governance, and token migration. This plugin provides actions for depositing into the USDS savings rate vault (sUSDS), checking token balances, managing approvals, and converting legacy DAI/MKR tokens to their successors USDS/SKY.

Supported chains: Ethereum (all contracts), Base (USDS, sUSDS), Arbitrum (USDS, sUSDS). Read-only actions work without credentials. Write actions require a connected wallet.

## Actions

| Action | Type | Credentials | Description |
|--------|------|-------------|-------------|
| Deposit USDS to Savings | Write | Wallet | Deposit USDS into the sUSDS savings vault |
| Withdraw USDS from Savings | Write | Wallet | Withdraw USDS from the savings vault by asset amount |
| Redeem sUSDS Shares | Write | Wallet | Redeem sUSDS shares for USDS |
| Get sUSDS Balance | Read | No | Check sUSDS balance of an address |
| Preview Savings Deposit | Read | No | Preview shares received for a given USDS deposit |
| Get USDS Value of sUSDS | Read | No | Convert sUSDS shares to their USDS value |
| Get USDS Balance | Read | No | Check USDS balance of an address |
| Get DAI Balance | Read | No | Check DAI balance of an address |
| Get SKY Balance | Read | No | Check SKY balance of an address |
| Approve USDS Spending | Write | Wallet | Approve a spender for USDS transfers |
| Approve DAI Spending | Write | Wallet | Approve a spender for DAI transfers |
| Convert DAI to USDS | Write | Wallet | Convert DAI to USDS at 1:1 rate |
| Convert USDS to DAI | Write | Wallet | Convert USDS back to DAI at 1:1 rate |
| Convert MKR to SKY | Write | Wallet | Convert MKR governance tokens to SKY |

---

## Deposit USDS to Savings

Deposit USDS into the sUSDS savings vault (ERC-4626). Shares are minted to the receiver proportional to the current exchange rate.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| assets | uint256 | USDS Amount (wei) |
| receiver | address | Receiver Address |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Earn yield on idle USDS, automate savings deposits after receiving funds, compound rewards by depositing periodically.

---

## Withdraw USDS from Savings

Withdraw a specific amount of USDS from the sUSDS savings vault. Burns the corresponding shares from the owner.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| assets | uint256 | USDS Amount (wei) |
| receiver | address | Receiver Address |
| owner | address | Share Owner Address |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Withdraw savings when funds are needed, automate partial withdrawals based on conditions.

---

## Redeem sUSDS Shares

Redeem a specific number of sUSDS shares for the underlying USDS. The amount of USDS received depends on the current exchange rate.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| shares | uint256 | sUSDS Shares (wei) |
| receiver | address | Receiver Address |
| owner | address | Share Owner Address |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Exit savings position entirely, redeem a specific share amount rather than a target USDS amount.

---

## Get sUSDS Balance

Check the sUSDS balance of any address on supported chains.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| account | address | Wallet Address |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| balance | uint256 | sUSDS Balance (wei), 18 decimals |

**When to use:** Monitor savings positions, track sUSDS holdings across wallets, trigger actions based on balance thresholds.

---

## Preview Savings Deposit

Preview how many sUSDS shares a given USDS deposit would yield at the current exchange rate. Does not execute a transaction.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| assets | uint256 | USDS Amount (wei) |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| shares | uint256 | sUSDS Shares Received, 18 decimals |

**When to use:** Calculate expected shares before depositing, display savings rate information, compare rates across vaults.

---

## Get USDS Value of sUSDS

Convert sUSDS shares to their underlying USDS value at the current exchange rate. Does not execute a transaction.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| shares | uint256 | sUSDS Shares (wei) |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| assets | uint256 | USDS Value (wei), 18 decimals |

**When to use:** Calculate the current value of a savings position, monitor accrued yield, display portfolio values in USDS terms.

---

## Get USDS Balance

Check the USDS stablecoin balance of any address.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| account | address | Wallet Address |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| balance | uint256 | USDS Balance (wei), 18 decimals |

**When to use:** Monitor USDS holdings, check wallet balances before initiating savings deposits or conversions.

---

## Get DAI Balance

Check the DAI stablecoin balance of any address (Ethereum only).

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| account | address | Wallet Address |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| balance | uint256 | DAI Balance (wei), 18 decimals |

**When to use:** Monitor legacy DAI holdings, identify wallets that should migrate from DAI to USDS.

---

## Get SKY Balance

Check the SKY governance token balance of any address (Ethereum only).

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| account | address | Wallet Address |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| balance | uint256 | SKY Balance (wei), 18 decimals |

**When to use:** Monitor SKY token holdings, track governance power, verify migration from MKR to SKY.

---

## Approve USDS Spending

Approve a spender address to transfer USDS on your behalf. Required before depositing USDS into the savings vault or other contracts.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| spender | address | Spender Address |
| amount | uint256 | Approval Amount (wei) |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Approve the sUSDS contract before depositing, set allowances for DeFi protocols, manage token permissions.

---

## Approve DAI Spending

Approve a spender address to transfer DAI on your behalf. Required before converting DAI to USDS.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| spender | address | Spender Address |
| amount | uint256 | Approval Amount (wei) |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Approve the DAI-USDS converter before migrating, set allowances for DeFi protocols.

---

## Convert DAI to USDS

Convert DAI to USDS at a 1:1 rate via the official Sky Protocol converter. Ethereum only. Requires prior DAI approval for the converter contract.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| usr | address | Recipient Address |
| amount | uint256 | DAI Amount (wei) |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Migrate DAI holdings to USDS, automate batch DAI-to-USDS conversions, prepare funds for sUSDS deposits.

---

## Convert USDS to DAI

Convert USDS back to DAI at a 1:1 rate via the official Sky Protocol converter. Ethereum only. Requires prior USDS approval for the converter contract.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| usr | address | Recipient Address |
| amount | uint256 | USDS Amount (wei) |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Convert USDS back to DAI for protocols that only accept DAI, manage liquidity across both stablecoins.

---

## Convert MKR to SKY

Convert MKR governance tokens to SKY via the official Sky Protocol converter. Ethereum only. This is a one-way conversion.

**Inputs:**

| Input | Type | Description |
|-------|------|-------------|
| usr | address | Recipient Address |
| mkrAmt | uint256 | MKR Amount (wei) |

**Outputs:** `success`, `transactionHash`, `transactionLink`, `error`

**When to use:** Migrate MKR holdings to the new SKY governance token, automate MKR-to-SKY conversion for treasury management.

---

## Example Workflows

### Monitor USDS Balance with Alert

`Schedule (daily) -> Sky: Get USDS Balance -> Math (Sum, divide by 1e18) -> Condition (< 100) -> Discord: Send Message`

Check your USDS balance daily, convert from wei to decimal, and send a Discord alert if it drops below 100 USDS.

### Auto-Deposit Idle USDS into Savings

`Schedule (hourly) -> Sky: Get USDS Balance -> Math (Sum, divide by 1e18) -> Condition (> 500) -> Sky: Approve USDS Spending -> Sky: Deposit USDS to Savings`

Periodically check for idle USDS and automatically deposit into the sUSDS savings vault when the balance exceeds a threshold. Requires wallet connection.

### Track Savings Yield

`Schedule (daily) -> Sky: Get sUSDS Balance -> Sky: Get USDS Value of sUSDS -> Math (Sum, divide by 1e18) -> HTTP Request (POST to webhook)`

Monitor your sUSDS position, convert shares to their current USDS value, and send the result to an external webhook for portfolio tracking.

### DAI Migration Pipeline

`Manual -> Sky: Get DAI Balance -> Math (Sum, divide by 1e18) -> Condition (> 0) -> Sky: Approve DAI Spending -> Sky: Convert DAI to USDS -> Sky: Deposit USDS to Savings`

One-click migration of DAI holdings: check balance, approve the converter, convert to USDS, and deposit into savings. Ethereum only.

---

## Supported Chains

| Chain | Contracts Available |
|-------|-------------------|
| Ethereum (1) | sUSDS, USDS, DAI, SKY, DAI-USDS Converter, MKR-SKY Converter |
| Base (8453) | sUSDS, USDS |
| Arbitrum (42161) | sUSDS, USDS |

The savings vault (sUSDS) and USDS stablecoin are available on all three chains. DAI, SKY, and the converter contracts are Ethereum-only.
