---
title: "Workflow Examples"
description: "Real-world workflow configuration examples for DeFi, treasury management, and security automation."
---

# Workflow Use Cases

## 1-Node Workflows (Simple Automation)

### 1. DeFi Position Alert

**Watcher Configuration:**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xa0b86a33e6776808dc27240c0fb3a09bbb65b1f4 (Compound cETH)
Trigger: Cron (every 15 minutes)
Function: Read - getAccountLiquidity(address account)
Conditions:
  - Function Output: (uint256) liquidity ratio
  - Operator: less than (<)
  - Value: 1.5 (1.5 ETH)
Actions: 
  - Notifications: Email
  - Message: "WARNING: Liquidation risk - Collateral ratio below 150%"
Status: Active
```

### 2. Treasury Balance Monitor

**Multisig Configuration:**
```
Network: Ethereum Mainnet
Keeper Type: Multisig
Proxy Address: 0x123...ABC (DAO Treasury Safe)
Implementation Address: 0x456...DEF (from Etherscan verification)
Trigger: Event (ownership changes)
Conditions: None (alert on any change)
Actions:
  - Notifications: Discord
  - Channel: #treasury-alerts
  - Message: "ALERT: Treasury multisig ownership changed"
Status: Active
```

### 3. Smart Refill System

**Watcher Configuration:**
```
Network: Ethereum Mainnet
Keeper Type: Wallet
Wallet Address: 0xABC...123 (Trading Bot Wallet)
Trigger: Cron (every hour)
Function: Balance check
Conditions:
  - Function Output: wallet balance
  - Operator: less than (<)
  - Value: 0.1 (0.1 ETH)
Actions:
  - Transfer: ETH
  - From: 0xDEF...456 (Para wallet)
  - To: 0xABC...123 (Trading Bot Wallet)
  - Amount: 0.4 ETH
  - Transfer on: All (when condition met)
  - Notifications: Slack #bot-alerts
Status: Active
```

## 2-Node Workflows (Conditional Chains)

### 1. Auto-Harvest Rewards

**Node 1 - Watcher:**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0x789...GHI (Uniswap V3 Staker)
Trigger: Cron (daily at 12:00 UTC)
Function: Read - earned(address account)
Conditions:
  - Function Output: (uint256) rewards
  - Operator: greater than (>)
  - Value: 10 (10 tokens)
Actions:
  - Notifications: Discord #defi-alerts
Status: Active
```

**Node 2 - Poker (triggered when Node 1 condition is met):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0x789...GHI (Uniswap V3 Staker)
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 condition)
Function: Write - harvest()
Actions:
  - Notifications: Email
  - Message: "Rewards harvested automatically"
Status: Active
```

### 2. Liquidation Protection

**Node 1 - Watcher:**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0x789...CDP (MakerDAO CDP)
Trigger: Cron (every 5 minutes)
Function: Read - getCollateralRatio(uint256 cdpId)
Conditions:
  - Function Output: (uint256) ratio
  - Operator: less than (<)
  - Value: 1.6 (160%)
Actions:
  - Notifications: Discord #liquidation-alerts
Status: Active
```

**Node 2 - Poker (triggered when Node 1 condition is met):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0x789...CDP (MakerDAO CDP)
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 condition)
Function: Write - addCollateral(uint256 cdpId, uint256 amount)
Parameters:
  - cdpId: 12345
  - amount: 0.5 (0.5 ETH)
Actions:
  - Notifications: Email
  - Message: "Emergency collateral added to CDP"
Status: Active
```

### 3. Governance Response

**Node 1 - Multisig:**
```
Network: Ethereum Mainnet
Keeper Type: Multisig
Proxy Address: 0xGOV...123 (Governance Safe)
Implementation Address: 0xIMP...456
Trigger: Event (transaction queue changes)
Conditions: None (trigger on any new proposal)
Actions:
  - Notifications: Discord #governance
Status: Active
```

**Node 2 - Watcher (triggered when Node 1 detects activity):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xGOV...789 (Governance Token)
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 activity)
Function: Read - getVotes(uint256 proposalId)
Conditions:
  - Function Output: (uint256) votes
  - Operator: greater than (>)
  - Value: 1000 (1000 votes)
Actions:
  - Notifications: Slack #governance-updates
  - Message: "Proposal gaining traction: ${votes} votes"
Status: Active
```

## 3-Node Workflows (Complex Logic)

### 1. Complete DeFi Strategy

**Node 1 - Watcher:**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xFARM...123 (Yield Farm Contract)
Trigger: Cron (every 6 hours)
Function: Read - pendingRewards(address user)
Conditions:
  - Function Output: (uint256) rewards
  - Operator: greater than (>)
  - Value: 5 (5 tokens)
Actions: None (workflow trigger only)
Status: Active
```

**Node 2 - Poker (when Node 1 condition is met):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xFARM...123
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 condition)
Function: Write - harvest()
Actions:
  - Notifications: Discord #farming-alerts
  - Message: "Harvested rewards automatically"
Status: Active
```

**Node 3 - Filler (when Node 2 completes):**
```
Network: Ethereum Mainnet
Keeper Type: Wallet
Source Keeper: [Node 2 ID]
Trigger: Event (based on Node 2 completion)
Actions:
  - Transfer: ETH
  - From: 0xMAIN...789 (Para wallet)
  - To: 0xSTRAT...456 (Strategy Wallet A)
  - Amount: 2 ETH
  - Transfer on: All
  - Notifications: Email
  - Message: "Profits distributed to strategy wallets"
Status: Active
```

### 2. Security Response Chain

**Node 1 - Multisig:**
```
Network: Ethereum Mainnet
Keeper Type: Multisig
Proxy Address: 0xPROT...123 (Protocol Safe)
Implementation Address: 0xIMP...789
Trigger: Event (owner changes)
Conditions:
  - Monitor: Owner additions
Actions:
  - Notifications: Discord #security-alerts
  - Message: "SECURITY ALERT: New owner added to protocol multisig"
Status: Active
```

**Node 2 - Watcher (when Node 1 detects unauthorized change):**
```
Network: Ethereum Mainnet
Keeper Type: Wallet
Wallet Address: 0xPROT...456 (Protocol Treasury)
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 detection)
Function: Balance monitoring
Conditions:
  - Function Output: outgoing transactions
  - Operator: greater than (>)
  - Value: 0 (any outgoing transaction)
Actions:
  - Notifications: Slack #emergency
Status: Active
```

**Node 3 - Poker (when Node 2 detects suspicious activity):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xPROT...789 (Protocol Contract)
Source Keeper: [Node 2 ID]
Trigger: Event (based on Node 2 detection)
Function: Write - emergencyPause()
Actions:
  - Notifications: Email + Discord + Slack
  - Message: "EMERGENCY: Protocol paused due to security incident"
  - Webhook: https://security-api.protocol.com/emergency
Status: Active
```

### 3. Treasury Management

**Node 1 - Watcher:**
```
Network: Ethereum Mainnet
Keeper Type: Wallet
Wallet Address: 0xDAO...123 (DAO Treasury)
Trigger: Cron (daily)
Function: Balance check
Conditions:
  - Function Output: wallet balance
  - Operator: greater than (>)
  - Value: 100 (100 ETH)
Actions: None (workflow trigger only)
Status: Active
```

**Node 2 - Poker (when treasury exceeds threshold):**
```
Network: Ethereum Mainnet
Keeper Type: Contract
Contract Address: 0xGOV...456 (Governance Contract)
Source Keeper: [Node 1 ID]
Trigger: Event (based on Node 1 condition)
Function: Write - proposeDistribution(uint256 amount)
Parameters:
  - amount: 50 (50 ETH)
Actions:
  - Notifications: Discord #governance
  - Message: "Treasury distribution proposal created"
Status: Active
```

**Node 3 - Multisig (monitor proposal execution):**
```
Network: Ethereum Mainnet
Keeper Type: Multisig
Proxy Address: 0xDAO...789 (DAO Execution Safe)
Implementation Address: 0xIMP...ABC
Source Keeper: [Node 2 ID]
Trigger: Event (based on Node 2 proposal)
Conditions: None (monitor all executions)
Actions:
  - Notifications: Email + Discord
  - Message: "Treasury distribution executed"
  - Webhook: https://dao-api.com/treasury-update
Status: Active
```