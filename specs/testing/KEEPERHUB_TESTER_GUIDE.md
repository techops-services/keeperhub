# KeeperHub Testing Specification

## Overview

This guide walks testers through the complete KeeperHub workflow automation platform. By the end, you will have:

- Created an account and configured connections (Discord, Slack)
- Set up a Web3 wallet and funded it with Sepolia ETH
- Built and tested 4 workflows covering all trigger types:
  - **Schedule** - Automated recurring balance monitoring
  - **Manual** - On-demand ETH transfers
  - **Webhook** - HTTP-triggered contract interactions
  - **Event** - Blockchain event listeners
- Tested the Hub marketplace for workflow templates
- (Bonus) Tested multisig monitoring and ERC20 token operations

**Test Network**: Sepolia (Chain ID: 11155111)

**Test URL**: https://workflows.keeperhub.com/

**Secrets**: Search "KeeperHub Test 2026" in 1Password for CloudFlare headers, Discord webhook, and Slack bot token.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Account and Connections](#2-account-and-connections)
3. [Wallet Setup](#3-wallet-setup)
4. [Workflow Testing](#4-workflow-testing)
5. [Hub Marketplace](#5-hub-marketplace)
6. [Completion Checklist](#6-completion-checklist)
7. [Bonus Tests](#7-bonus-tests)

---

## 1. Environment Setup

### Modheader Extension (Required)

Install Modheader from your browser's extension store, then configure:

**Request Headers** (values from 1Password "KeeperHub Test 2026"):
- `CF-Access-Client-Id`: [value from 1Password]
- `CF-Access-Client-Secret`: [value from 1Password]

**Request domain filter**: `workflows.keeperhub.com`

Verify by navigating to https://workflows.keeperhub.com/ - you should see the login page.

### Test Contract

**SimpleStorage Contract**: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
- [View on Etherscan](https://sepolia.etherscan.io/address/0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad#code)

Functions: `retrieve()`, `store(uint256)`, `addPerson(string, uint256)`
Events: `FavoriteNumberUpdated`, `NewPersonAdded`

---

## 2. Account and Connections

### 2.1 Create Account

1. Go to https://workflows.keeperhub.com/
2. Sign up with your email
3. Complete verification
4. Verify default organization is created

### 2.2 Configure Connections

Navigate to **Settings > Connections** and configure:

| Connection | Source | Notes |
|------------|--------|-------|
| Discord | 1Password "KeeperHub Test 2026" | Channel: `#keeperhub-test` |
| Slack | 1Password "KeeperHub Test 2026" | Channel: `#keeperhub-test` |

**Expected**: Both connections show as active in your connections list.

---

## 3. Wallet Setup

### 3.1 Create Wallet

1. Navigate to **Settings > Wallet**
2. Click "Create Wallet"
3. Record your wallet address: `0x_____________________`

### 3.2 Request Sepolia ETH

Contact Admin via Slack/Discord with your wallet address to request Sepolia ETH.

### 3.3 Verify Balance

Confirm your ETH balance displays correctly in the wallet section. Stablecoin balances (USDC, USDT, USDS) will show as 0.

---

## 4. Workflow Testing

**Important**: Schedule and Event workflows start **disabled**. Enable them after creation for automatic execution.

### Node Types Reference

| Trigger | Description |
|---------|-------------|
| Manual | User-initiated |
| Schedule | Cron-based |
| Webhook | HTTP endpoint |
| Event | Blockchain events |

| Action | Plugin |
|--------|--------|
| Check Balance, Transfer ETH, Read/Write Contract | Web3 |
| Send Message | Discord, Slack |
| HTTP Request | Webhook |
| Condition | Logic branching |

---

### Workflow 1: Balance Watcher (Schedule Trigger)

**Tests**: Schedule trigger, Check Balance, Condition, Webhook node, Discord notification

**Flow**: Schedule (5 min) -> Check Balance -> Condition (< 0.1 ETH) -> Webhook + Discord

#### Setup these node types

**Note**: When referencing node values (e.g., balance from Check Balance), do not paste values manually. Type `@` to open the reference popup and select the node output you want to use.

1. Create workflow: "Balance Watcher - [Your Name]"
2. **Trigger**: Schedule, cron `*/5 * * * *`
3. **Check Balance**: Your wallet address, Sepolia network
4. **Condition**: `{{@action-1:Check Balance.balance}} < 0.1`
   - Note: Condition node has a single exit point. To handle multiple outcomes, create additional Condition nodes (e.g., one for `< 0.5` and another for `> 0.5`)
5. **Webhook**:
   - Get unique URL from https://webhook.site/
   - Method: POST, Body: `{"balance": "{{@action-1:Check Balance.balance}}"}`
6. **Discord**: "Low balance alert: {{@action-1:Check Balance.balance}} ETH"

#### Test

1. Run manually - verify balance check and condition evaluation
2. Check webhook.site for received POST
3. **Enable workflow** for scheduled execution
4. Wait 5 minutes, verify automatic execution in logs

---

### Workflow 2: ETH Transfer (Manual Trigger)

**Tests**: Manual trigger, Transfer ETH, self-transfer pattern

**Flow**: Manual -> Check Balance -> Transfer ETH (to self) -> Discord

#### Setup these node types

**Note**: When referencing node values, type `@` to open the reference popup instead of pasting values manually.

1. Create workflow: "ETH Transfer - [Your Name]"
2. **Trigger**: Manual
3. **Check Balance**: Your wallet, Sepolia
4. **Transfer ETH**:
   - To Address: YOUR OWN WALLET (self-transfer for testing)
   - Amount: `0.001`
   - Network: Sepolia
5. **Discord**: "Transfer complete. New balance: {{@check-balance:Check Balance.balance}} ETH"

#### Test

1. Note pre-test balance
2. Execute workflow
3. Verify transaction on [Sepolia Etherscan](https://sepolia.etherscan.io/)
4. Confirm balance reduced by gas fees only (self-transfer)

---

### Workflow 3: Contract Interaction (Webhook Trigger)

**Tests**: Webhook trigger, Read Contract, Write Contract, Condition, curl with auth headers

**Flow**: Webhook -> Read Contract -> Condition -> Write Contract -> Read (verify) -> Discord

#### Setup these node types

**Note**: When referencing node values, type `@` to open the reference popup instead of pasting values manually.

**Important**: Give each Read Contract node a descriptive label (e.g., "Initial Read", "Verify Read") since multiple Read Contract nodes can be confusing when referencing values.

1. Create workflow: "Contract Test - [Your Name]"
2. **Trigger**: Webhook (note the generated URL)
3. **Read Contract** (label: "Initial Read"):
   - Address: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
   - Function: `retrieve`
   - Network: Sepolia
4. **Condition**: `{{@read:Initial Read.result}} < 1000`
5. **Write Contract**:
   - Function: `store`
   - Parameters: `1234`
6. **Read Contract** (label: "Verify Read"): Same config as step 3
7. **Discord**: "Contract updated. Old: {{@read:Initial Read.result}}, New: {{@verify:Verify Read.result}}"

#### Test

**Create User API Token**: Navigate to **Settings > API Tokens** and create a **User** API token (not Organisation). Copy the token for use in the curl command below.

Trigger with curl (get CF header values from 1Password):

```bash
curl -X POST [YOUR_WEBHOOK_URL] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "CF-Access-Client-Id: [FROM_1PASSWORD]" \
  -H "CF-Access-Client-Secret: [FROM_1PASSWORD]" \
  -d '{"action": "test_contract"}'
```

Verify:
1. Workflow executes on webhook receipt
2. Read returns current value
3. Write transaction visible on Etherscan
4. Verification read confirms new value

---

### Workflow 4: Contract Event Watcher (Event Trigger)

**Tests**: Event trigger, blockchain event detection

**Flow**: Event Trigger -> Discord

This workflow monitors the SimpleStorage contract for `FavoriteNumberUpdated` events.

**Note**: Each workflow can only listen to one specific event. To monitor multiple events (e.g., both `FavoriteNumberUpdated` and `NewPersonAdded`), create separate workflows for each event.

#### Setup these node types

**Note**: When referencing node values, type `@` to open the reference popup instead of pasting values manually.

1. Create workflow: "Contract Events - [Your Name]"
2. **Trigger**: Event
   - Address: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
   - Network: Sepolia
   - Event: `FavoriteNumberUpdated`
3. **Discord**:
   ```
   Contract Event Detected!
   Event: {{@trigger:Event Listener.eventName}}
   Tx: {{@trigger:Event Listener.transactionHash}}
   ```

#### Test

1. **Enable the workflow**
2. Trigger an event by running Workflow 3 (Contract Interaction) - the `store()` call emits `FavoriteNumberUpdated`
3. Verify event detected in workflow logs
4. Confirm Discord notification received

**Optional**: Create a second workflow to monitor `NewPersonAdded` events, then test by calling `addPerson("TestUser", 42)` via Etherscan.

---

## 5. Hub Marketplace

### Test Template Usage

1. Navigate to **Hub** from main navigation
2. Find a reference workflow template (Balance Watcher, ETH Filler, etc.)
3. Click "Use Template"
4. Verify workflow duplicated to your list
5. Update placeholder values with your data
6. Execute and verify functionality

---

## 6. Completion Checklist

### Setup
- [ ] Modheader configured with CloudFlare headers
- [ ] Account created, organization verified
- [ ] Discord and Slack connections active
- [ ] Wallet created and funded with Sepolia ETH

### Workflows
- [ ] Workflow 1: Schedule trigger + balance monitoring + webhook node
- [ ] Workflow 2: Manual trigger + ETH transfer
- [ ] Workflow 3: Webhook trigger + contract read/write
- [ ] Workflow 4: Event trigger + contract event detection

### Hub
- [ ] Templates visible and duplicatable
- [ ] Duplicated workflow executes correctly

---

## 7. Bonus Tests

Complete these after the main test phases.

### Bonus 1: Safe Multisig Watcher

Monitor Safe multisig ownership changes on Sepolia.

**Prerequisites**: Create a Safe at https://app.safe.global on Sepolia network.

**Note**: Each workflow can only listen to one specific event. To monitor multiple Safe events, create separate workflows for each event type.

**Workflow Setup** (create one workflow per event):

**Workflow A - AddedOwner**:
1. **Trigger**: Event
   - Address: Your Safe contract address
   - Network: Sepolia
   - Event: `AddedOwner`
2. **Discord**: "Owner Added! Tx: {{@trigger:Event Listener.transactionHash}}"

**Workflow B - RemovedOwner**:
1. **Trigger**: Event (same address/network, Event: `RemovedOwner`)
2. **Discord**: "Owner Removed! Tx: {{@trigger:Event Listener.transactionHash}}"

**Workflow C - ChangedThreshold**:
1. **Trigger**: Event (same address/network, Event: `ChangedThreshold`)
2. **Discord**: "Threshold Changed! Tx: {{@trigger:Event Listener.transactionHash}}"

**Test**: Enable workflows, then add/remove an owner in your Safe. Verify event detection.

---

### Bonus 2: ERC20 Token Operations

Requires test ERC20 tokens on Sepolia (request from Admin or use a faucet).

**Check Token Balance**:
- Add "Check Token Balance" node with token contract address
- Verify balance displays correctly

**Transfer Token**:
- Add "Transfer Token" node
- To Address: Your own wallet (self-transfer)
- Amount: Small amount (e.g., 1 token)
- Verify transaction on Etherscan

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot access KeeperHub | Verify Modheader headers and domain filter |
| Balance shows 0 | Ensure Sepolia network selected |
| Transfer fails | Request more ETH from Admin |
| Event not detected | Enable the workflow (Schedule/Event start disabled) |
| Webhook not triggering | Include CF-Access headers in curl command |
| Contract read fails | Verify correct network and contract address |

**Getting Help**: Contact Admin with workflow ID, execution ID, and error screenshots.
