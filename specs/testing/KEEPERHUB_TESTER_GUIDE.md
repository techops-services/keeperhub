# KeeperHub Testing Specification

## Document Purpose

This document provides a comprehensive testing guide for new testers to fully test KeeperHub functionality. The testing covers user onboarding, wallet management, connections, and workflow creation across all available node types.

---

## Table of Contents

1. [Prerequisites and Requirements](#1-prerequisites-and-requirements)
2. [Environment Setup](#2-environment-setup)
3. [Phase 1: Account Setup](#phase-1-account-setup)
4. [Phase 2: Connection Configuration](#phase-2-connection-configuration)
5. [Phase 3: Wallet Setup and Funding](#phase-3-wallet-setup-and-funding)
6. [Phase 4: Workflow Testing](#phase-4-workflow-testing)
7. [Phase 5: Hub Marketplace Testing](#phase-5-hub-marketplace-testing)
8. [Test Completion Checklist](#test-completion-checklist)
9. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites and Requirements

### Test Network

All testing will be performed on the **Sepolia** testnet (Chain ID: 11155111).

### Test Contract

The test contract for event monitoring is deployed at:
- **Address**: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
- **Etherscan**: https://sepolia.etherscan.io/address/0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad#code

### What Testers Need Before Starting

| Item | Source | Notes |
|------|--------|-------|
| KeeperHub account | Self-registration | Create during testing |
| Sepolia ETH | Request from Admin | Provide your KH wallet address |
| Discord webhook URL | Provided by Admin | For notification testing |
| Slack webhook URL | Provided by Admin | For notification testing |
| Safe multisig on Sepolia | Create in Safe app | For Event trigger testing |

### Tools Required

1. **Web browser** (Chrome/Firefox recommended)
2. **MetaMask** or similar wallet (for Safe multisig testing)
3. **Safe app access**: https://app.safe.global

---

## 2. Environment Setup

### Test Environment URL

Access KeeperHub at the URL provided by your administrator.

### Browser Preparation

1. Clear browser cache if you have tested before
2. Disable any ad blockers for the KeeperHub domain
3. Enable JavaScript and cookies

---

## Phase 1: Account Setup

### Test 1.1: User Registration

**Objective**: Verify new user signup flow and default organization creation.

**Steps**:
1. Navigate to the KeeperHub application URL
2. Click "Sign Up" or "Get Started"
3. Enter your email address
4. Complete the authentication flow (email verification or OAuth)
5. Verify you land on the dashboard

**Expected Results**:
- [ ] Account created successfully
- [ ] Default organization automatically created
- [ ] Redirected to main dashboard
- [ ] Organization name visible in header/sidebar

**Notes**: Record your organization name: `_____________________`

### Test 1.2: Organization Verification

**Objective**: Confirm organization settings are accessible.

**Steps**:
1. Navigate to Settings (gear icon or settings menu)
2. Locate Organization settings section
3. Verify organization details are displayed

**Expected Results**:
- [ ] Organization name displayed correctly
- [ ] Organization slug is set
- [ ] You are listed as owner/admin

---

## Phase 2: Connection Configuration

Connections are required for workflow nodes to function. Configure each connection type before proceeding to workflow testing.

### Test 2.1: Discord Connection

**Objective**: Set up Discord webhook for notifications.

**Prerequisites**: Obtain Discord webhook URL from Admin.

**Steps**:
1. Navigate to Settings > Connections (or Integrations)
2. Find Discord integration
3. Click "Add" or "Configure"
4. Enter the webhook URL provided by Admin
5. Save the connection
6. Optionally test the connection if a test button is available

**Expected Results**:
- [ ] Discord connection saved successfully
- [ ] Connection appears in your connections list
- [ ] Connection shows as "Active" or "Connected"

**Admin-Provided Webhook URL**: `_____________________`

### Test 2.2: Slack Connection (Optional)

**Objective**: Set up Slack webhook for notifications.

**Prerequisites**: Obtain Slack webhook URL from Admin.

**Steps**:
1. Navigate to Settings > Connections
2. Find Slack integration
3. Click "Add" or "Configure"
4. Enter the bot token or webhook URL provided by Admin
5. Save the connection

**Expected Results**:
- [ ] Slack connection saved successfully
- [ ] Connection appears in your connections list

**Admin-Provided Webhook URL**: `_____________________`

### Test 2.3: Email (SendGrid) Connection

**Objective**: Configure email sending capability.

**Steps**:
1. Navigate to Settings > Connections
2. Find SendGrid or Email integration
3. Choose one of the following:
   - Use KeeperHub's default API key (if available)
   - Enter your own SendGrid API key
4. Save the connection

**Expected Results**:
- [ ] Email connection saved successfully
- [ ] Connection appears in your connections list

**Note**: If using KeeperHub's default key, no configuration may be needed.

---

## Phase 3: Wallet Setup and Funding

### Test 3.1: Create KeeperHub Wallet

**Objective**: Create an organization wallet for Web3 operations.

**Steps**:
1. Navigate to Settings > Wallet (or Web3 section)
2. Click "Create Wallet" button
3. Wait for wallet generation to complete
4. Note your new wallet address

**Expected Results**:
- [ ] Wallet created successfully
- [ ] Wallet address displayed (0x format)
- [ ] Wallet shows on Sepolia network

**Your Wallet Address**: `0x_____________________`

### Test 3.2: Request Sepolia ETH

**Objective**: Obtain test ETH for workflow testing.

**Steps**:
1. Copy your KeeperHub wallet address from Test 3.1
2. Contact your Admin via the designated channel
3. Provide your wallet address
4. Request Sepolia ETH for testing
5. Wait for Admin confirmation

**Message Template**:
```
Hi, I need Sepolia ETH for KeeperHub testing.
My wallet address: [YOUR_ADDRESS]
```

**Expected Results**:
- [ ] Admin confirms ETH sent
- [ ] Transaction hash received (optional)

### Test 3.3: Verify Wallet Balance

**Objective**: Confirm ETH received and balance display works.

**Steps**:
1. Navigate to Settings > Wallet
2. Check balance display for ETH
3. Verify the amount matches what Admin sent
4. Check stablecoin balances display (should show 0 for USDC, USDT, USDS)

**Expected Results**:
- [ ] ETH balance displayed correctly
- [ ] Balance updates reflected in UI
- [ ] Stablecoin balances show (even if 0)

**Confirmed Balance**: `_____ ETH`

### Test 3.4: Web3 Connection Verification

**Objective**: Verify Web3 connection is ready for workflow nodes.

**Steps**:
1. Navigate to Settings > Connections
2. Verify Web3 connection shows as configured
3. Confirm Sepolia network is selected/available

**Expected Results**:
- [ ] Web3 connection active
- [ ] Sepolia network available in network selector

---

## Phase 4: Workflow Testing

This phase tests all workflow node types by building 4 reference workflows. Each workflow tests different trigger types and action combinations.

### Understanding Node Types

**Trigger Nodes** (Required - starts every workflow):
| Type | Description | Use Case |
|------|-------------|----------|
| Manual | User-initiated execution | Testing, on-demand tasks |
| Schedule | Cron-based timing | Recurring checks, reports |
| Webhook | HTTP endpoint trigger | External integrations, APIs |
| Event | Blockchain event listener | Contract monitoring |

**Action Nodes**:
| Plugin | Actions | Notes |
|--------|---------|-------|
| Web3 | Check Balance, Transfer ETH, Transfer ERC20, Read Contract, Write Contract | Requires wallet + network |
| Discord | Send Message | Requires webhook URL |
| Slack | Send Message | Requires bot token |
| SendGrid | Send Email | Requires API key or default |
| Webhook | HTTP Request | GET, POST, PUT, PATCH, DELETE |
| Condition | Evaluate Expression | Controls workflow branching |

---

### Workflow 1: Wallet ETH Balance Watcher

**Trigger Type**: Schedule
**Purpose**: Monitor wallet balance and send notifications when below threshold.

#### What This Workflow Tests

- Schedule trigger (cron)
- Check Balance action (Web3)
- Condition node (branching logic)
- Send Email action (SendGrid)
- Send Discord Message action
- Variable references between nodes

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Schedule | Cron: `*/5 * * * *` (every 5 minutes) |
| Check Balance | Web3 Action | Address: Your wallet, Network: Sepolia |
| Condition | Logic | `balance < 0.1` |
| Send Email | SendGrid | Alert email with balance info |
| Send Discord | Discord | Alert message with balance info |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Click "New Workflow" from dashboard
   - Name: "Balance Watcher Test - [Your Name]"
   - Description: "Tests schedule trigger with balance monitoring"

2. **Add Schedule Trigger**
   - Select trigger type: "Schedule"
   - Set cron expression: `*/5 * * * *`
   - Description: "Executes every 5 minutes"

3. **Add Check Balance Node**
   - Click "+" to add action
   - Select: Web3 > Check Balance
   - Configure:
     - Address: `{{env.KH_WALLET_ADDRESS}}` OR paste your wallet address
     - Network: Sepolia (11155111)
     - Integration: Select your Web3 connection
   - Label: "Check Balance"

4. **Add Condition Node**
   - Click "+" after Check Balance
   - Select: Condition
   - Configure:
     - Condition: `{{@action-1:Check Balance.balance}} < 0.1`
   - Label: "Low Balance Condition"

5. **Add Email Notification (True Branch)**
   - Click "+" on the condition true output
   - Select: SendGrid > Send Email
   - Configure:
     - To: Your email address
     - Subject: "Wallet Running Low!"
     - Body: "Your wallet balance is {{@action-1:Check Balance.balance}} ETH"
   - Label: "Send Email"

6. **Add Discord Notification (True Branch)**
   - Connect another output from condition
   - Select: Discord > Send Message
   - Configure:
     - Message: "Alert: Wallet balance is low! Current: {{@action-1:Check Balance.balance}} ETH"
   - Label: "Send Discord"

7. **Connect Edges**
   - Trigger → Check Balance
   - Check Balance → Condition
   - Condition → Send Email
   - Condition → Send Discord

8. **Save Workflow**

#### Testing Procedure

1. **Manual Test First**
   - Click "Run" or "Execute" button
   - Observe execution flow
   - Verify each node shows execution status

2. **Verify Outputs**
   - Check Balance should return your actual ETH balance
   - If balance < 0.1: notifications should send
   - If balance >= 0.1: workflow should stop at condition

3. **Test Scheduled Execution** (Optional)
   - Enable the workflow
   - Wait for scheduled trigger (5 minutes)
   - Verify execution log shows automatic run

**Expected Results**:
- [ ] Workflow created successfully
- [ ] Manual execution completes
- [ ] Balance retrieved correctly
- [ ] Condition evaluates properly
- [ ] Notifications sent (if condition met)

---

### Workflow 2: Wallet ETH Filler (Transfer Test)

**Trigger Type**: Schedule
**Purpose**: Test ETH transfer functionality by sending to yourself.

#### What This Workflow Tests

- Transfer ETH action (Web3)
- Self-transfer (recipient = your address)
- Transaction confirmation
- Discord notifications

#### Important: Self-Transfer Testing

For testing purposes, **set the recipient address as your own wallet address**. This allows you to test the transfer functionality without needing another wallet.

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Schedule | Cron: `*/15 * * * *` (every 15 minutes) |
| Check Balance | Web3 Action | Check your wallet balance |
| Condition | Logic | `balance < 0.1` |
| Send Notification | Discord | Pre-transfer alert |
| Transfer ETH | Web3 Action | Send 0.01 ETH to yourself |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Name: "ETH Filler Test - [Your Name]"
   - Description: "Tests ETH transfer to self"

2. **Add Schedule Trigger**
   - Cron: `*/15 * * * *`

3. **Add Check Balance Node**
   - Address: Your wallet address
   - Network: Sepolia

4. **Add Condition Node**
   - Condition: `{{@check-balance:Check Balance.balance}} < 0.1`

5. **Add Discord Notification**
   - Message: "Low balance detected: {{@check-balance:Check Balance.balance}} ETH. Initiating test transfer..."

6. **Add Transfer ETH Node**
   - **To Address**: YOUR OWN WALLET ADDRESS (self-transfer for testing)
   - **Amount**: `0.01` (small amount for testing)
   - **Network**: Sepolia (11155111)
   - **Wallet ID**: Your KH Wallet ID
   - **Integration**: Your Web3 connection

7. **Connect Nodes**
   - Trigger → Check Balance → Condition → (Notification + Transfer in parallel)

8. **Save Workflow**

#### Testing Procedure

1. **Pre-Test Verification**
   - Note your current ETH balance: `_____ ETH`
   - Ensure you have > 0.02 ETH (0.01 transfer + gas)

2. **Execute Workflow**
   - Run workflow manually
   - Monitor Transfer ETH node execution
   - Note transaction hash if displayed

3. **Post-Test Verification**
   - Balance should be approximately the same (minus gas fees)
   - Check Etherscan for transaction: https://sepolia.etherscan.io/address/[YOUR_ADDRESS]

**Expected Results**:
- [ ] Transfer executes successfully
- [ ] Transaction visible on Etherscan
- [ ] Balance reflects gas fee deduction
- [ ] Discord notification received

---

### Workflow 3: Monthly Salary Distribution (Multiple Transfers)

**Trigger Type**: Schedule
**Purpose**: Test parallel transfer execution and workflow branching.

#### What This Workflow Tests

- Parallel node execution
- Multiple Transfer ETH actions
- Node-to-node data flow
- Aggregated notifications

#### Configuration Details

This workflow simulates distributing funds to multiple recipients. For testing, **all recipient addresses will be your own wallet**.

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Schedule | Monthly: `0 0 1 * *` |
| Transfer 1-5 | Web3 Transfers | 0.001 ETH each to self |
| Notification | Discord | Summary message |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Name: "Salary Distribution Test - [Your Name]"
   - Description: "Tests multiple parallel transfers"

2. **Add Schedule Trigger**
   - Cron: `0 0 1 * *` (1st of each month at midnight)
   - For testing, we'll execute manually

3. **Add 5 Transfer Nodes (All to Self)**

   For each transfer (1-5):
   - Select: Web3 > Transfer Funds
   - To Address: YOUR WALLET ADDRESS
   - Amount: `0.001` ETH
   - Network: Sepolia
   - Label: "Transfer to Contractor [1-5]"

4. **Connect Trigger to All Transfers**
   - Trigger connects to all 5 transfer nodes (parallel execution)

5. **Add Discord Summary Node**
   - Connect all 5 transfers to this node
   - Message: "Distribution Test Complete! 5 transfers of 0.001 ETH each processed."

6. **Save Workflow**

#### Testing Procedure

1. **Pre-Test Balance**: `_____ ETH`

2. **Execute Workflow**
   - Run manually
   - Observe parallel execution of transfers

3. **Post-Test Balance**: `_____ ETH`
   - Should be reduced by ~0.005 ETH + gas fees

**Expected Results**:
- [ ] All 5 transfers execute
- [ ] Parallel execution visible in logs
- [ ] Summary notification sent
- [ ] 5 transactions visible on Etherscan

---

### Workflow 4: Safe Multisig Watcher (Event Trigger)

**Trigger Type**: Event
**Purpose**: Monitor Safe multisig contract events on Sepolia.

#### Prerequisites: Safe Multisig Setup

Before building this workflow, you must create a Safe multisig on Sepolia.

##### Creating Your Safe Multisig

1. **Navigate to Safe App**
   - Go to: https://app.safe.global
   - Connect your MetaMask (or other wallet)
   - Switch to Sepolia network

2. **Create New Safe**
   - Click "Create Safe"
   - Select Sepolia network
   - Add owners (at least yourself)
   - Set threshold (e.g., 1 of 1 for testing)
   - Deploy the Safe contract

3. **Record Your Safe Address**
   - Safe Address: `0x_____________________`

#### What This Workflow Tests

- Event trigger (blockchain event listener)
- Contract address monitoring
- Event filtering with conditions
- Real-time event detection

#### Events to Monitor

| Event Name | When Triggered |
|------------|----------------|
| AddedOwner | New owner added to Safe |
| RemovedOwner | Owner removed from Safe |
| ChangedThreshold | Signature threshold changed |

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Event | Contract: Your Safe address |
| Event Filter | Condition | Filter for specific events |
| Notification | Discord | Alert message with event details |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Name: "Multisig Watcher Test - [Your Name]"
   - Description: "Monitors Safe ownership changes"

2. **Add Event Trigger**
   - Trigger Type: Event
   - Event Address: YOUR SAFE CONTRACT ADDRESS
   - Event Network: Sepolia (11155111)
   - Event Name: `*` (wildcard to capture all events)

3. **Add Event Filter Condition**
   - Condition expression:
   ```
   {{@trigger:Event Listener.eventName}} == "AddedOwner" ||
   {{@trigger:Event Listener.eventName}} == "RemovedOwner" ||
   {{@trigger:Event Listener.eventName}} == "ChangedThreshold"
   ```
   - Label: "Event Filter"

4. **Add Discord Notification**
   - Message:
   ```
   Safe Multisig Alert!

   Event: {{@trigger:Event Listener.eventName}}
   Contract: {{@trigger:Event Listener.eventAddress}}
   Transaction: {{@trigger:Event Listener.transactionHash}}

   Check your Safe for ownership/threshold changes.
   ```

5. **Connect Nodes**
   - Event Trigger → Event Filter → Discord Notification

6. **Save and Enable Workflow**

#### Testing Procedure

1. **Enable Workflow**
   - Toggle workflow to "Enabled" state
   - Workflow now listens for events

2. **Trigger AddedOwner Event**
   - Go to Safe app: https://app.safe.global
   - Open your Safe
   - Navigate to Settings > Owners
   - Add a new owner address (can be any valid Ethereum address)
   - Confirm transaction

3. **Verify Event Detection**
   - Return to KeeperHub
   - Check workflow execution logs
   - Verify Discord notification received

4. **Trigger ChangedThreshold Event** (Optional)
   - In Safe, change the threshold (e.g., 1 to 2)
   - Verify event captured

5. **Trigger RemovedOwner Event** (Optional)
   - Remove the owner you added
   - Verify event captured

**Expected Results**:
- [ ] Workflow listens for events
- [ ] AddedOwner event detected
- [ ] Event details captured correctly
- [ ] Discord notification received
- [ ] Transaction hash links to Etherscan

---

### Additional Trigger Tests

#### Test 4.5: Manual Trigger

**Objective**: Verify manual workflow execution.

**Steps**:
1. Create a simple workflow with Manual trigger
2. Add a Discord notification: "Manual trigger test executed"
3. Save workflow
4. Click "Run" or "Execute"
5. Verify execution and notification

**Expected Results**:
- [ ] Manual trigger available as option
- [ ] Workflow executes on button click
- [ ] Notification received

#### Test 4.6: Webhook Trigger

**Objective**: Test HTTP webhook-triggered workflows.

**Steps**:
1. Create workflow with Webhook trigger
2. Note the generated webhook URL
3. Add Discord notification with payload data: `{{trigger.body}}`
4. Save and enable workflow
5. Send POST request to webhook URL:
   ```bash
   curl -X POST [WEBHOOK_URL] \
     -H "Content-Type: application/json" \
     -d '{"test": "data", "message": "Webhook test"}'
   ```
6. Verify execution

**Expected Results**:
- [ ] Webhook URL generated
- [ ] POST request triggers workflow
- [ ] Payload data accessible in workflow
- [ ] Notification includes payload content

---

## Phase 5: Hub Marketplace Testing

The Hub is KeeperHub's workflow marketplace where users can find and use pre-built workflow templates.

### Test 5.1: Access Hub

**Objective**: Verify Hub/Marketplace is accessible.

**Steps**:
1. Navigate to Hub from main navigation
2. Browse available workflow templates
3. View template details

**Expected Results**:
- [ ] Hub page loads successfully
- [ ] Public workflow templates displayed
- [ ] Template details visible (name, description, node count)

### Test 5.2: Use Template

**Objective**: Test workflow template duplication.

**Steps**:
1. Find one of the 4 reference workflows:
   - Wallet ETH Balance Watcher
   - Wallet ETH Filler
   - Monthly Salary Distribution
   - Safe Multisig Watcher

2. Click "Use Template" button
3. Template should be duplicated to your workflows
4. Verify duplicated workflow in your workflow list
5. Open and review the duplicated workflow
6. Update configuration with your specific values:
   - Your wallet address
   - Your webhook URLs
   - Your Safe address (for Multisig Watcher)

**Expected Results**:
- [ ] Template duplicated successfully
- [ ] Workflow appears in your list
- [ ] All nodes preserved from template
- [ ] Configuration editable

### Test 5.3: Execute Template Workflow

**Objective**: Run a workflow created from template.

**Steps**:
1. Open duplicated workflow
2. Update all placeholder values with your actual data
3. Save changes
4. Execute workflow
5. Verify execution completes

**Expected Results**:
- [ ] Template workflow executes
- [ ] Actions perform correctly
- [ ] Results match expected behavior

---

## Test Completion Checklist

### Phase 1: Account Setup
- [ ] User registration completed
- [ ] Organization created
- [ ] Settings accessible

### Phase 2: Connections
- [ ] Discord connection configured
- [ ] Slack connection configured (if applicable)
- [ ] Email/SendGrid connection configured
- [ ] All connections show as active

### Phase 3: Wallet
- [ ] KeeperHub wallet created
- [ ] Sepolia ETH received
- [ ] Balance displays correctly
- [ ] Web3 connection verified

### Phase 4: Workflows
- [ ] Workflow 1 (Balance Watcher) - Schedule + Check Balance + Condition + Notifications
- [ ] Workflow 2 (ETH Filler) - Transfer ETH self-test
- [ ] Workflow 3 (Salary Distribution) - Parallel transfers
- [ ] Workflow 4 (Multisig Watcher) - Event trigger with Safe
- [ ] Manual trigger tested
- [ ] Webhook trigger tested

### Phase 5: Hub
- [ ] Hub accessible
- [ ] Templates visible
- [ ] Template duplication works
- [ ] Duplicated workflow executes

---

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Wallet creation fails | Email not verified | Complete email verification |
| Balance shows 0 | Network mismatch | Ensure Sepolia selected |
| Transfer fails | Insufficient funds | Request more ETH from Admin |
| Discord notification not received | Invalid webhook URL | Verify URL with Admin |
| Event not detected | Workflow not enabled | Toggle workflow to enabled |
| Webhook not triggering | Wrong HTTP method | Use POST request |

### Getting Help

1. Document the issue with screenshots
2. Note the workflow ID and execution ID
3. Contact Admin with:
   - Your email/username
   - Issue description
   - Steps to reproduce
   - Error messages (if any)

---

## Reference Information

### Test Contract Details

- **Address**: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
- **Network**: Sepolia (Chain ID: 11155111)
- **Etherscan**: https://sepolia.etherscan.io/address/0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad#code

### Network Information

| Network | Chain ID | Explorer |
|---------|----------|----------|
| Sepolia | 11155111 | https://sepolia.etherscan.io |

### Cron Expression Reference

| Expression | Meaning |
|------------|---------|
| `*/5 * * * *` | Every 5 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 * * *` | Daily at midnight |
| `0 0 1 * *` | Monthly on 1st at midnight |

### Variable Reference Syntax

Reference previous node outputs using:
```
{{@node-id:Node Label.fieldName}}
```

Example:
```
{{@action-1:Check Balance.balance}}
{{@trigger:Event Listener.eventName}}
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | TechOps | Initial version |
