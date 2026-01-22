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
10. [Bonus Tests: ERC20 Token Operations](#bonus-tests-erc20-token-operations)

---

## 1. Prerequisites and Requirements

### Test Network

All testing will be performed on the **Sepolia** testnet (Chain ID: 11155111).

### Test Contracts

**SimpleStorage Contract** (for Read/Write testing):
- **Address**: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
- **Etherscan**: https://sepolia.etherscan.io/address/0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad#code

### Secret Values

All secret values for testing are stored in 1Password:
- **Search for**: "KeeperHub Test 2026"
- **Contains**: CloudFlare headers, Discord webhook, Slack bot token

### What Testers Need Before Starting

| Item | Source | Notes |
|------|--------|-------|
| KeeperHub account | Self-registration | Create during testing |
| Sepolia ETH | Request from Admin | Provide your KH wallet address |
| Modheader extension | Chrome/Firefox store | Required for app access |
| 1Password access | "KeeperHub Test 2026" | CloudFlare, Discord, Slack secrets |
| Safe multisig on Sepolia | Create in Safe app | For Event trigger testing |

### Tools Required

1. **Web browser** (Chrome/Firefox recommended)
2. **Modheader browser extension** (required for access)
3. **MetaMask** or similar wallet (for Safe multisig testing)
4. **Safe app access**: https://app.safe.global
5. **Terminal/CLI** (for curl commands)

---

## 2. Environment Setup

### Test Environment URL

**KeeperHub Test URL**: https://workflows.keeperhub.com/

### Modheader Extension Setup (Required)

You must configure the Modheader browser extension to access KeeperHub.

**Installation**:
1. Install Modheader extension from your browser's extension store:
   - Chrome: https://chrome.google.com/webstore/detail/modheader
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/modheader/

**Configuration**:
1. Open Modheader extension
2. Add the following **Request Headers** (get values from 1Password "KeeperHub Test 2026"):
   - `X-Auth-Email`: [value from 1Password]
   - `X-Auth-Key`: [value from 1Password]
3. Add **Request domain filter**:
   - Filter: `workflows.keeperhub.com`
4. Ensure the profile is enabled (toggle on)

**Verification**:
1. Navigate to https://workflows.keeperhub.com/
2. If configured correctly, you should see the KeeperHub login/signup page
3. If you see an access denied error, verify your Modheader configuration

### Browser Preparation

1. Clear browser cache if you have tested before
2. Disable any ad blockers for the KeeperHub domain
3. Enable JavaScript and cookies
4. Verify Modheader extension is active

---

## Phase 1: Account Setup

### Test 1.1: User Registration

**Objective**: Verify new user signup flow and default organization creation.

**Steps**:
1. Navigate to https://workflows.keeperhub.com/
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

**Prerequisites**: Get Discord webhook URL from 1Password "KeeperHub Test 2026"

**Steps**:
1. Navigate to Settings > Connections (or Integrations)
2. Find Discord integration
3. Click "Add" or "Configure"
4. Enter the webhook URL from 1Password
5. Save the connection
6. Optionally test the connection if a test button is available

**Expected Results**:
- [ ] Discord connection saved successfully
- [ ] Connection appears in your connections list
- [ ] Connection shows as "Active" or "Connected"

**Note**: Discord channel is `#keeperhub-test`. All testers should already be invited to this channel.

### Test 2.2: Slack Connection

**Objective**: Set up Slack bot for notifications.

**Prerequisites**: Get Slack bot token from 1Password "KeeperHub Test 2026"

**Steps**:
1. Navigate to Settings > Connections
2. Find Slack integration
3. Click "Add" or "Configure"
4. Enter the bot token from 1Password
5. Save the connection

**Expected Results**:
- [ ] Slack connection saved successfully
- [ ] Connection appears in your connections list

**Note**: Slack channel is `#keeperhub-test`. All testers should already be invited to this channel.

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
2. Contact your Admin via the designated channel (Slack/Discord)
3. Provide your wallet address and request Sepolia ETH
4. Wait for Admin confirmation

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

### Important: Schedule and Event Workflows

Schedule and Event trigger workflows start in **disabled** mode by default. After creating these workflows, you must **enable** them in KeeperHub for them to execute automatically.

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
- Webhook node (external HTTP request)
- Send Email action (SendGrid)
- Send Discord Message action
- Variable references between nodes

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Schedule | Cron: `*/5 * * * *` (every 5 minutes) |
| Check Balance | Web3 Action | Address: Your wallet, Network: Sepolia |
| Condition | Logic | `balance < 0.1` |
| Webhook | HTTP Request | POST to webhook.site |
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

5. **Add Webhook Node**
   - Go to https://webhook.site/ and get your unique URL
   - Click "+" on the condition true output
   - Select: Webhook > HTTP Request
   - Configure:
     - Method: POST
     - URL: Your unique webhook.site URL
     - Headers: `Content-Type: application/json`
     - Body: `{"alert": "low_balance", "balance": "{{@action-1:Check Balance.balance}}"}`
   - Label: "Webhook Alert"

   **Your webhook.site URL**: `_____________________`

6. **Add Email Notification (True Branch)**
   - Click "+" after Webhook node
   - Select: SendGrid > Send Email
   - Configure:
     - To: Your email address
     - Subject: "Wallet Running Low!"
     - Body: "Your wallet balance is {{@action-1:Check Balance.balance}} ETH"
   - Label: "Send Email"

7. **Add Discord Notification (True Branch)**
   - Connect another output from condition
   - Select: Discord > Send Message
   - Configure:
     - Message: "Alert: Wallet balance is low! Current: {{@action-1:Check Balance.balance}} ETH"
   - Label: "Send Discord"

8. **Connect Edges**
   - Trigger -> Check Balance
   - Check Balance -> Condition
   - Condition -> Webhook -> Send Email
   - Condition -> Send Discord

9. **Save Workflow**

#### Testing Procedure

1. **Manual Test First**
   - Click "Run" or "Execute" button
   - Observe execution flow
   - Verify each node shows execution status

2. **Verify Outputs**
   - Check Balance should return your actual ETH balance
   - If balance < 0.1: notifications should send
   - If balance >= 0.1: workflow should stop at condition

3. **Verify Webhook**
   - Go to your webhook.site URL
   - Verify the POST request was received with balance data

4. **Enable and Test Scheduled Execution**
   - **Enable the workflow** (toggle to enabled state)
   - Wait for scheduled trigger (5 minutes)
   - Verify execution log shows automatic run

**Expected Results**:
- [ ] Workflow created successfully
- [ ] Manual execution completes
- [ ] Balance retrieved correctly
- [ ] Condition evaluates properly
- [ ] Webhook receives POST request
- [ ] Notifications sent (if condition met)
- [ ] Scheduled execution works when enabled

---

### Workflow 2: Wallet ETH Filler (Transfer Test)

**Trigger Type**: Manual
**Purpose**: Test ETH transfer functionality by sending to yourself.

#### What This Workflow Tests

- Manual trigger
- Check Balance action (Web3)
- Condition node
- Transfer ETH action (Web3)
- Self-transfer (recipient = your address)
- Transaction confirmation
- Discord notifications

#### Important: Self-Transfer Testing

For testing purposes, **set the recipient address as your own wallet address**. This allows you to test the transfer functionality without needing another wallet.

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Manual | User-initiated |
| Check Balance | Web3 Action | Check your wallet balance |
| Condition | Logic | `balance < 0.1` |
| Send Notification | Discord | Pre-transfer alert |
| Transfer ETH | Web3 Action | Send 0.01 ETH to yourself |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Name: "ETH Filler Test - [Your Name]"
   - Description: "Tests ETH transfer to self"

2. **Add Manual Trigger**
   - Select trigger type: "Manual"
   - Description: "Manually triggered for testing"

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
   - Trigger -> Check Balance -> Condition -> (Notification + Transfer in parallel)

8. **Save Workflow**

#### Testing Procedure

1. **Pre-Test Verification**
   - Note your current ETH balance: `_____ ETH`
   - Ensure you have > 0.02 ETH (0.01 transfer + gas)

2. **Execute Workflow**
   - Click "Run" or "Execute" button
   - Monitor Transfer ETH node execution
   - Note transaction hash if displayed

3. **Post-Test Verification**
   - Balance should be approximately the same (minus gas fees)
   - Check Etherscan for transaction: https://sepolia.etherscan.io/address/[YOUR_ADDRESS]

**Expected Results**:
- [ ] Manual trigger executes workflow
- [ ] Transfer executes successfully
- [ ] Transaction visible on Etherscan
- [ ] Balance reflects gas fee deduction
- [ ] Discord notification received

---

### Workflow 3: Smart Contract Read/Write Tester

**Trigger Type**: Manual
**Purpose**: Test smart contract Read and Write functionality with conditional logic.

#### What This Workflow Tests

- Read Contract action (Web3)
- Write Contract action (Web3)
- Condition node with contract data
- Sequential read-write-read flow
- Discord notifications with contract data

#### Test Contract: SimpleStorage

The SimpleStorage contract provides simple read/write functions for testing:

| Function | Type | Description |
|----------|------|-------------|
| `retrieve()` | Read | Returns the stored favorite number |
| `store(uint256)` | Write | Stores a new favorite number |
| `nameToFavoriteNumber(string)` | Read | Returns favorite number for a name |
| `addPerson(string, uint256)` | Write | Adds a person with name and number |

**Contract Address**: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`

#### Configuration Details

| Node | Type | Configuration |
|------|------|---------------|
| Trigger | Manual | User-initiated |
| Read Current Value | Web3 Read | Call `retrieve()` |
| Condition | Logic | Check if value needs update |
| Write New Value | Web3 Write | Call `store(uint256)` |
| Read Updated Value | Web3 Read | Verify with `retrieve()` |
| Notification | Discord | Report results |

#### Step-by-Step Build Instructions

1. **Create New Workflow**
   - Name: "Contract Read/Write Test - [Your Name]"
   - Description: "Tests smart contract interactions"

2. **Add Manual Trigger**
   - Select trigger type: "Manual"

3. **Add Read Contract Node (Initial Read)**
   - Select: Web3 > Read Contract
   - Configure:
     - Contract Address: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
     - Network: Sepolia (11155111)
     - Function: `retrieve`
     - ABI: (Auto-fetch or paste contract ABI)
   - Label: "Read Current Value"

4. **Add Condition Node**
   - Configure:
     - Condition: `{{@read-current:Read Current Value.result}} < 1000`
   - Label: "Check If Update Needed"
   - Description: "Triggers write if current value is less than 1000"

5. **Add Write Contract Node (True Branch)**
   - Select: Web3 > Write Contract
   - Configure:
     - Contract Address: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
     - Network: Sepolia (11155111)
     - Function: `store`
     - Parameters: `1234` (or any number you want to store)
     - ABI: (Auto-fetch or paste contract ABI)
   - Label: "Store New Value"

6. **Add Read Contract Node (Verification Read)**
   - Select: Web3 > Read Contract
   - Configure:
     - Contract Address: `0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad`
     - Network: Sepolia (11155111)
     - Function: `retrieve`
   - Label: "Verify Updated Value"

7. **Add Discord Notification**
   - Message:
   ```
   Contract Read/Write Test Complete!

   Initial Value: {{@read-current:Read Current Value.result}}
   New Value Stored: 1234
   Verified Value: {{@verify:Verify Updated Value.result}}

   Contract: 0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad
   ```

8. **Connect Nodes**
   - Trigger -> Read Current Value -> Condition
   - Condition (true) -> Store New Value -> Verify Updated Value -> Discord Notification
   - Condition (false) -> Discord Notification (with "no update needed" message)

9. **Save Workflow**

#### Testing Procedure

1. **Execute Workflow**
   - Click "Run" or "Execute"
   - Watch execution flow through each node

2. **Verify Read Operations**
   - Initial read should return the current stored value
   - Verification read should show your newly stored value

3. **Verify Write Operation**
   - Check Etherscan for the transaction
   - Verify the `store` function was called with your value

4. **Verify on Etherscan**
   - Go to: https://sepolia.etherscan.io/address/0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad#readContract
   - Call `retrieve()` to confirm your value is stored

**Expected Results**:
- [ ] Read Contract returns current value
- [ ] Condition evaluates correctly
- [ ] Write Contract executes transaction
- [ ] Transaction visible on Etherscan
- [ ] Verification read shows updated value
- [ ] Discord notification received with all values

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
   - Event Trigger -> Event Filter -> Discord Notification

6. **Save Workflow**

7. **Enable Workflow**
   - **Important**: Event workflows start disabled. Toggle to **enabled** state.

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
- [ ] Workflow enabled successfully
- [ ] Workflow listens for events
- [ ] AddedOwner event detected
- [ ] Event details captured correctly
- [ ] Discord notification received
- [ ] Transaction hash links to Etherscan

---

### Additional Trigger Test: Webhook Trigger

#### Test: Webhook Trigger with CloudFlare Auth

**Objective**: Test HTTP webhook-triggered workflows with authentication headers.

**Steps**:

1. **Create Workflow with Webhook Trigger**
   - Create new workflow
   - Name: "Webhook Test - [Your Name]"
   - Select trigger type: "Webhook"
   - Note the generated webhook URL

2. **Add Discord Notification**
   - Message: `Webhook received! Payload: {{trigger.body}}`

3. **Save and Enable Workflow**

4. **Get CloudFlare Headers**
   - Open 1Password and search for "KeeperHub Test 2026"
   - Copy the `X-Auth-Email` and `X-Auth-Key` values

5. **Test with curl Command**

   Open your terminal and run:
   ```bash
   curl -X POST [YOUR_WEBHOOK_URL] \
     -H "Content-Type: application/json" \
     -H "X-Auth-Email: [VALUE_FROM_1PASSWORD]" \
     -H "X-Auth-Key: [VALUE_FROM_1PASSWORD]" \
     -d '{"test": "data", "message": "Webhook trigger test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
   ```

   Replace:
   - `[YOUR_WEBHOOK_URL]` with your generated webhook URL
   - `[VALUE_FROM_1PASSWORD]` with actual values from 1Password

6. **Verify Execution**
   - Check KeeperHub for workflow execution
   - Verify Discord notification received with payload data

**Expected Results**:
- [ ] Webhook URL generated
- [ ] curl command executes successfully
- [ ] Workflow triggered by POST request
- [ ] Payload data accessible in workflow
- [ ] Discord notification includes payload content

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
1. Find one of the reference workflows:
   - Wallet ETH Balance Watcher
   - Wallet ETH Filler
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
- [ ] Slack connection configured
- [ ] Email/SendGrid connection configured
- [ ] All connections show as active

### Phase 3: Wallet
- [ ] KeeperHub wallet created
- [ ] Sepolia ETH received
- [ ] Balance displays correctly
- [ ] Web3 connection verified

### Phase 4: Workflows
- [ ] Workflow 1 (Balance Watcher) - Schedule + Check Balance + Condition + Webhook + Notifications
- [ ] Workflow 2 (ETH Filler) - Manual + Transfer ETH self-test
- [ ] Workflow 3 (Contract Read/Write) - Read + Write + Condition + Verify
- [ ] Workflow 4 (Multisig Watcher) - Event trigger with Safe
- [ ] Webhook trigger tested with curl

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
| Cannot access KeeperHub | Modheader not configured | Check Modheader headers and domain filter |
| Wallet creation fails | Email not verified | Complete email verification |
| Balance shows 0 | Network mismatch | Ensure Sepolia selected |
| Transfer fails | Insufficient funds | Request more ETH from Admin |
| Discord notification not received | Invalid webhook URL | Verify URL in 1Password |
| Event not detected | Workflow not enabled | Toggle workflow to enabled state |
| Webhook not triggering | Missing auth headers | Include CloudFlare headers in curl |
| Schedule not running | Workflow disabled | Enable the workflow |
| Contract read fails | Wrong network | Ensure Sepolia network selected |

### Getting Help

1. Document the issue with screenshots
2. Note the workflow ID and execution ID
3. Contact Admin with:
   - Your email/username
   - Issue description
   - Steps to reproduce
   - Error messages (if any)

---

## Bonus Tests: ERC20 Token Operations

These bonus tests require test ERC20 tokens on Sepolia. Complete these after finishing the main test phases.

### Acquiring Test ERC20 Tokens

To test token operations, you need test ERC20 tokens on Sepolia. Options:

1. **Sepolia USDC/USDT Faucets**
   - Search for "Sepolia USDC faucet" or "Sepolia test tokens"
   - Some DeFi testnet apps provide test tokens

2. **Request from Admin**
   - Ask Admin if they can send test ERC20 tokens to your wallet

3. **Bridge from Other Testnets**
   - Some bridge protocols support testnet token transfers

**Your Test Token Details**:
- Token Address: `0x_____________________`
- Token Symbol: `_____`
- Amount Received: `_____`

### Bonus Test 1: Check Token Balance

**Objective**: Test the Check Token Balance (ERC20) node.

**Steps**:
1. Create a new workflow or modify an existing one
2. Add a "Check Token Balance" node (Web3)
3. Configure:
   - Token Address: Your test token contract address
   - Wallet Address: Your KeeperHub wallet address
   - Network: Sepolia
4. Add a Discord notification with the balance
5. Execute the workflow

**Expected Results**:
- [ ] Token balance retrieved correctly
- [ ] Balance shows in correct decimal format
- [ ] Notification displays token amount

### Bonus Test 2: Transfer Token (ERC20)

**Objective**: Test the Transfer Token (ERC20) node.

**Steps**:
1. Create a new workflow
2. Add Manual trigger
3. Add "Check Token Balance" node to verify you have tokens
4. Add "Transfer Token" node:
   - **To Address**: YOUR OWN WALLET ADDRESS (self-transfer)
   - **Amount**: Small amount (e.g., 1 token)
   - **Token Address**: Your test token contract
   - **Network**: Sepolia
5. Add Discord notification with transfer details
6. Execute the workflow

**Expected Results**:
- [ ] Token transfer executes successfully
- [ ] Transaction visible on Etherscan
- [ ] Gas fee deducted from ETH balance
- [ ] Token balance unchanged (self-transfer minus fees)
- [ ] Notification received

### Bonus Test 3: Token Balance Monitoring Workflow

**Objective**: Create a complete token monitoring workflow.

**Steps**:
1. Create workflow: "Token Monitor - [Your Name]"
2. Add Schedule trigger (every 10 minutes)
3. Add Check Token Balance node
4. Add Condition: `balance < 100` (adjust threshold as needed)
5. Add Discord notification for low balance alert
6. Enable workflow and verify scheduled execution

**Expected Results**:
- [ ] Workflow monitors token balance on schedule
- [ ] Condition evaluates token balance correctly
- [ ] Notifications sent when below threshold

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | TechOps | Initial version |
| 1.1 | 2026-01-22 | TechOps | Added Modheader setup, webhook testing, contract R/W workflow, bonus ERC20 tests |
