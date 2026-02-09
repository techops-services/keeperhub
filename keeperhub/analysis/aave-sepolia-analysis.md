# Protocol Analysis: Aave (Sepolia Testnet)

**Category**: Lending / Borrowing
**Chain**: Ethereum Sepolia (chain ID: `11155111`)
**Documentation**: [Aave V3 Docs](https://aave.com/docs/aave-v3/overview) | [Address Book (GitHub)](https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Sepolia.sol)
**Faucet**: [Aave Sepolia Faucet](https://gho.aave.com/faucet/) (10,000 tokens per mint)

## Key Contracts

| Contract | Address | Role |
|----------|---------|------|
| Pool | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` | Main entry point: supply, borrow, repay, withdraw, liquidate |
| PoolAddressesProvider | `0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A` | Registry of all protocol component addresses |
| AaveOracle | `0x2da88497588bf89281816106C7259e31AF45a663` | Asset price feeds |
| AaveProtocolDataProvider | `0x3e9708d80f7B3e43118013075F7e95CE3AB31F31` | Read-only protocol data (reserves, user positions) |
| UiPoolDataProvider | `0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE` | Aggregated UI data (reserves, user balances) |
| PoolConfigurator | `0x7Ee60D184C24Ef7AfC1Ec7Be59A0f448A0abd138` | Pool configuration management |
| ACLManager | `0x7F2bE3b178deeFF716CD6Ff03Ef79A1dFf360ddD` | Access control and permissions |
| DefaultIncentivesController | `0x4DA5c4da71C5a167171cC839487536d86e083483` | Reward distribution |
| Faucet | `0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D` | Test token minting |
| WETHGateway | `0x387d311e47e80b498169e6fb51d3193167d89F7D` | ETH wrapping for supply/withdraw |
| WalletBalanceProvider | `0xCD4e0d6D2b1252E2A709B8aE97DBA31164C5a709` | Batch wallet balance reads |
| Collector | `0x604264f8017fEF3b11B3dD63537CB501560380B5` | Protocol fee collection |

## Test Token Addresses

| Token | Underlying Address | Decimals | aToken Address | vToken Address |
|-------|-------------------|----------|----------------|----------------|
| DAI | `0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357` | 18 | `0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8` | `0x22675C506A8FC26447aFFfa33640f6af5d4D4cF0` |
| USDC | `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8` | 6 | `0x16dA4541aD1807f4443d92D26044C1147406EB80` | `0x36B5dE936eF1710E1d22EabE5231b28581a92ECc` |
| USDT | `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0` | 6 | `0xAF0F6e8b0Dc5c913bbF4d14c22B4E78Dd14310B6` | `0x9844386d29EEd970B9F6a2B9a676083b0478210e` |
| WETH | `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c` | 18 | `0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830` | `0x22a35DB253f4F6D0029025D6312A3BdAb20C2c6A` |
| WBTC | `0x29f2D40B0605204364af54EC677bD022dA425d03` | 8 | `0x1804Bf30507dc2EB3bDEbbbdd859991EAeF6EefF` | `0xEB016dFd303F19fbDdFb6300eB4AeB2DA7Ceac37` |
| LINK | `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5` | 18 | `0x3FfAf50D4F4E96eB78f2407c090b72e86eCaed24` | `0x34a4d932E722b9dFb492B9D8131127690CE2430B` |
| AAVE | `0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a` | 18 | `0x6b8558764d3b7572136F17174Cb9aB1DDc7E1259` | `0xf12fdFc4c631F6D361b48723c2F2800b84B519e6` |
| GHO | `0xc4bF5CbDaBE595361438F8c6a187bDc330539c60` | 18 | `0xd190eF37dB51Bb955A680fF1A85763CC72d083D4` | `0x67ae46EF043F7A4508BD1d6B94DB6c33F0915844` |
| EURS | `0x6d906e526a4e2Ca02097BA9d0caA3c382F52278E` | 2 | `0xB20691021F9AcED8631eDaa3c0Cd2949EB45662D` | `0x94482C7A7477196259D8a0f74fB853277Fa5a75b` |

## Oracle Addresses (per asset)

| Token | Oracle Address |
|-------|---------------|
| DAI | `0x9aF11c35c5d3Ae182C0050438972aac4376f9516` |
| LINK | `0x14fC51b7df22b4D393cD45504B9f0A3002A63F3F` |
| USDC | `0x98458D6A99489F15e6eB5aFa67ACFAcf6F211051` |
| WBTC | `0x784B90bA1E9a8cf3C9939c2e072F058B024C4b8a` |
| WETH | `0xDde0E8E6d3653614878Bf5009EDC317BC129fE2F` |
| USDT | `0x4e86D3Aa271Fa418F38D7262fdBa2989C94aa5Ba` |
| AAVE | `0xda678Ef100c13504edDb8a228A1e8e4CB139f189` |
| EURS | `0xCbE15C1f40f1D7eE1De3756D1557d5Fdc2A50bBD` |
| GHO | `0x00f7fecFAEbEd9499e1f3f9d04E755a21E5fc47C` |

## Protocol Overview

Aave is the largest decentralized lending and borrowing protocol in DeFi. Users supply assets to earn yield (receiving aTokens that accrue interest automatically) or borrow assets against their collateral at variable interest rates. The protocol calculates a "health factor" for each borrower -- when it drops below 1.0, the position becomes eligible for liquidation by third parties who earn a bonus for repaying the debt.

Aave V3 introduced Efficiency Mode (eMode) for higher borrowing power on correlated assets, Isolation Mode for new assets with capped debt ceilings, and gas-optimized L2 Pool contracts. It also supports flash loans (uncollateralized single-transaction loans) and a comprehensive event system that emits events for every user action.

The Sepolia testnet deployment mirrors the mainnet architecture exactly, making it ideal for testing KeeperHub workflow automations before deploying to production. The faucet provides up to 10,000 test tokens per mint, and all contracts are verified on Sepolia Etherscan -- meaning KeeperHub can auto-fetch ABIs.

## Pool Contract Events

### Supply
```solidity
event Supply(
  address indexed reserve,
  address user,
  address indexed onBehalfOf,
  uint256 amount,
  uint16 indexed referralCode
);
```

### Withdraw
```solidity
event Withdraw(
  address indexed reserve,
  address indexed user,
  address indexed to,
  uint256 amount
);
```

### Borrow
```solidity
event Borrow(
  address indexed reserve,
  address user,
  address indexed onBehalfOf,
  uint256 amount,
  DataTypes.InterestRateMode interestRateMode,
  uint256 borrowRate,
  uint16 indexed referralCode
);
```

### Repay
```solidity
event Repay(
  address indexed reserve,
  address indexed user,
  address indexed repayer,
  uint256 amount,
  bool useATokens
);
```

### LiquidationCall
```solidity
event LiquidationCall(
  address indexed collateralAsset,
  address indexed debtAsset,
  address indexed user,
  uint256 debtToCover,
  uint256 liquidatedCollateralAmount,
  address liquidator,
  bool receiveAToken
);
```

### FlashLoan
```solidity
event FlashLoan(
  address indexed target,
  address initiator,
  address indexed asset,
  uint256 amount,
  DataTypes.InterestRateMode interestRateMode,
  uint256 premium,
  uint16 indexed referralCode
);
```

### ReserveDataUpdated
```solidity
event ReserveDataUpdated(
  address indexed reserve,
  uint256 liquidityRate,
  uint256 stableBorrowRate,
  uint256 variableBorrowRate,
  uint256 liquidityIndex,
  uint256 variableBorrowIndex
);
```

### ReserveUsedAsCollateralEnabled
```solidity
event ReserveUsedAsCollateralEnabled(
  address indexed reserve,
  address indexed user
);
```

### ReserveUsedAsCollateralDisabled
```solidity
event ReserveUsedAsCollateralDisabled(
  address indexed reserve,
  address indexed user
);
```

### UserEModeSet
```solidity
event UserEModeSet(
  address indexed user,
  uint8 categoryId
);
```

### MintedToTreasury
```solidity
event MintedToTreasury(
  address indexed reserve,
  uint256 amountMinted
);
```

### MintUnbacked
```solidity
event MintUnbacked(
  address indexed reserve,
  address user,
  address indexed onBehalfOf,
  uint256 amount,
  uint16 indexed referralCode
);
```

### BackUnbacked
```solidity
event BackUnbacked(
  address indexed reserve,
  address indexed backer,
  uint256 amount,
  uint256 fee
);
```

## Key Read Functions

### Pool (`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`)

| Function | Parameters | Returns |
|----------|-----------|---------|
| `getUserAccountData` | `address user` | totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor |
| `getReserveData` | `address asset` | Full reserve configuration and state |
| `getReservesList` | none | Array of all reserve addresses |
| `getUserEMode` | `address user` | Current eMode category ID |

### AaveProtocolDataProvider (`0x3e9708d80f7B3e43118013075F7e95CE3AB31F31`)

| Function | Parameters | Returns |
|----------|-----------|---------|
| `getUserReserveData` | `address asset, address user` | aToken balance, debt amounts, borrow rates, liquidity rate, collateral flag |
| `getReserveConfigurationData` | `address asset` | decimals, ltv, liquidation threshold/bonus, reserve factor, flags |
| `getReserveCaps` | `address asset` | borrowCap, supplyCap |
| `getReserveData` | `address asset` | unbacked, accrued treasury, total aToken, debt amounts, rates, indices |
| `getATokenTotalSupply` | `address asset` | Total aToken supply |
| `getTotalDebt` | `address asset` | Total borrows |
| `getAllReservesTokens` | none | Token symbols and addresses |
| `getAllATokens` | none | aToken symbols and addresses |
| `getReserveTokensAddresses` | `address asset` | aToken, stableDebtToken, variableDebtToken addresses |
| `getPaused` | `address asset` | Whether reserve is paused |
| `getSiloedBorrowing` | `address asset` | Siloed borrowing flag |
| `getReserveDeficit` | `address asset` | Reserve deficit from undercollateralized positions |

### UiPoolDataProvider (`0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE`)

| Function | Parameters | Returns |
|----------|-----------|---------|
| `getReservesData` | `IPoolAddressesProvider provider` | AggregatedReserveData[], BaseCurrencyInfo |
| `getUserReservesData` | `IPoolAddressesProvider provider, address user` | UserReserveData[], uint8 |
| `getReservesList` | `IPoolAddressesProvider provider` | address[] |

### WalletBalanceProvider (`0xCD4e0d6D2b1252E2A709B8aE97DBA31164C5a709`)

| Function | Parameters | Returns |
|----------|-----------|---------|
| `balanceOf` | `address user, address token` | uint256 balance |
| `batchBalanceOf` | `address[] users, address[] tokens` | uint256[] balances |
| `getUserWalletBalances` | `address provider, address user` | address[], uint256[] |

## Key Write Functions

### Pool (`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `supply` | `address asset, uint256 amount, address onBehalfOf, uint16 referralCode` | Deposit assets, receive aTokens |
| `withdraw` | `address asset, uint256 amount, address to` | Withdraw underlying asset |
| `borrow` | `address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf` | Borrow assets (mode 2 = variable) |
| `repay` | `address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf` | Repay borrowed debt |
| `repayWithATokens` | `address asset, uint256 amount, uint256 interestRateMode` | Repay using aTokens directly |
| `liquidationCall` | `address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken` | Liquidate undercollateralized position |
| `flashLoanSimple` | `address receiverAddress, address asset, uint256 amount, bytes params, uint16 referralCode` | Single-asset flash loan |
| `setUserUseReserveAsCollateral` | `address asset, bool useAsCollateral` | Enable/disable collateral usage |
| `setUserEMode` | `uint8 categoryId` | Set efficiency mode (0 = none) |
| `supplyWithPermit` | `address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 v, bytes32 r, bytes32 s` | Supply using EIP-2612 permit |
| `repayWithPermit` | `address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf, uint256 deadline, uint8 v, bytes32 r, bytes32 s` | Repay using permit |

## KeeperHub Automation Opportunities

### Monitoring & Alerts

#### 1. Health Factor Monitor

**Trigger**: Schedule (every 5 minutes)
**What it does**: Reads a user's health factor and alerts when it drops below a safety threshold.

**Workflow nodes**:
1. Schedule trigger - cron `*/5 * * * *`
2. `web3/read-contract` - Call `getUserAccountData(address)` on Pool (`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`), network `11155111`
3. Condition - `{{@node2:ReadContract.result.healthFactor}} < 1500000000000000000` (health factor < 1.5, value is in 18 decimals)
4. `discord/send-message` - "Health factor alert: position at risk"

**Use case**: Any borrower wanting early warning before liquidation.
**Complexity**: Low

#### 2. Liquidation Event Watcher

**Trigger**: Event (LiquidationCall on Pool)
**What it does**: Listens for liquidation events and sends a notification with full details.

**Workflow nodes**:
1. Event trigger - `LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)` on `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`, network `11155111`
2. `discord/send-message` - "Liquidation: User {{user}} -- {{debtToCover}} debt covered, {{liquidatedCollateralAmount}} collateral seized"

**Use case**: Protocol monitors, liquidation bot operators, risk analysts.
**Complexity**: Low

#### 3. Large Deposit/Borrow Monitor

**Trigger**: Event (Supply or Borrow on Pool)
**What it does**: Captures supply or borrow events and alerts when amounts exceed a threshold.

**Workflow nodes**:
1. Event trigger - `Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)` on Pool, network `11155111`
2. Condition - `{{@node1:Event.amount}} > 1000000000000000000000` (threshold in token decimals)
3. `slack/send-message` - "Whale alert: large supply detected"

**Use case**: Whale watching, protocol analytics, treasury monitoring.
**Complexity**: Low

#### 4. aToken Balance Tracker

**Trigger**: Schedule (hourly)
**What it does**: Checks aToken balance to track yield accrual over time.

**Workflow nodes**:
1. Schedule trigger - cron `0 * * * *`
2. `web3/check-token-balance` - Check aDAI (`0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8`) balance, network `11155111`
3. `webhook/send-webhook` - POST balance data to analytics endpoint

**Use case**: Yield tracking, portfolio dashboards, accounting.
**Complexity**: Low

#### 5. Interest Rate Spike Alert

**Trigger**: Event (ReserveDataUpdated on Pool)
**What it does**: Listens for rate updates and alerts when borrow rates spike above a threshold.

**Workflow nodes**:
1. Event trigger - `ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)` on Pool, network `11155111`
2. Condition - `variableBorrowRate > threshold`
3. `telegram/send-message` - "Borrow rate spike detected"

**Use case**: Borrowers monitoring cost of capital, yield farmers.
**Complexity**: Low

### Automated Actions

#### 6. Auto-Repay on Low Health Factor

**Trigger**: Schedule (every 2 minutes)
**What it does**: Monitors health factor and automatically repays debt when dangerously low.

**Workflow nodes**:
1. Schedule trigger - cron `*/2 * * * *`
2. `web3/read-contract` - Call `getUserAccountData(address)` on Pool
3. Condition - `healthFactor < 1200000000000000000` (< 1.2)
4. `web3/write-contract` - Call `repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)` on Pool. Requires wallet integration + pre-approved token allowance.
5. `discord/send-message` - "Auto-repaid debt to restore health factor"

**Use case**: Automated liquidation protection.
**Complexity**: High (requires token approval and sufficient repayment balance)

#### 7. Auto-Supply Idle Tokens

**Trigger**: Schedule (daily) or Webhook
**What it does**: Checks wallet balance for idle tokens and auto-supplies them to Aave.

**Workflow nodes**:
1. Schedule trigger - cron `0 9 * * *`
2. `web3/check-token-balance` - Check USDC balance in wallet, network `11155111`
3. Condition - Balance > minimum threshold
4. `web3/write-contract` - Call `supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)` on Pool. Requires wallet integration.
5. `slack/send-message` - "Auto-supplied tokens to Aave"

**Use case**: Treasury management, passive yield optimization.
**Complexity**: High (requires token approval)

#### 8. Liquidation Bot

**Trigger**: Schedule (every minute)
**What it does**: Scans for undercollateralized positions and executes liquidation calls.

**Workflow nodes**:
1. Schedule trigger - cron `* * * * *`
2. `HTTP Request` - Query external API for positions with health factor < 1
3. Condition - Profitable liquidation opportunity found
4. `web3/write-contract` - Call `liquidationCall(...)` on Pool. Requires wallet integration.
5. `discord/send-message` - "Executed liquidation"

**Use case**: MEV searchers, liquidation bot operators.
**Complexity**: High

### Scheduled Tasks

#### 9. Daily Position Snapshot

**Trigger**: Schedule (daily)
**What it does**: Reads full user position data and sends a daily summary.

**Workflow nodes**:
1. Schedule trigger - cron `0 8 * * *`
2. `web3/read-contract` - Call `getUserAccountData(address)` on Pool
3. `web3/read-contract` - Call `getUserReserveData(address asset, address user)` on AaveProtocolDataProvider for each asset
4. `sendgrid/send-email` - Daily position summary

**Use case**: Portfolio tracking, risk management, compliance.
**Complexity**: Medium

#### 10. Reserve Cap Utilization Monitor

**Trigger**: Schedule (hourly)
**What it does**: Checks how close reserves are to their supply/borrow caps.

**Workflow nodes**:
1. Schedule trigger - cron `0 * * * *`
2. `web3/read-contract` - Call `getReserveCaps(address asset)` on AaveProtocolDataProvider
3. `web3/read-contract` - Call `getATokenTotalSupply(address asset)`
4. Condition - totalSupply > 90% of cap
5. `telegram/send-message` - "Reserve approaching cap"

**Use case**: Users wanting to supply before caps fill, governance monitoring.
**Complexity**: Medium

#### 11. Faucet Auto-Mint for Testing

**Trigger**: Schedule (weekly)
**What it does**: Calls the Sepolia faucet contract to mint test tokens.

**Workflow nodes**:
1. Schedule trigger - cron `0 0 * * 1`
2. `web3/write-contract` - Call mint on Faucet (`0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D`). Requires wallet integration.
3. `discord/send-message` - "Minted test tokens from faucet"

**Use case**: Automated test environment replenishment.
**Complexity**: Low (Sepolia-specific)

### Event-Driven Workflows

#### 12. Supply Event Webhook Relay

**Trigger**: Event (Supply on Pool)
**What it does**: Captures all supply events and forwards them to an external system.

**Workflow nodes**:
1. Event trigger - `Supply` on Pool, network `11155111`
2. `webhook/send-webhook` - POST event data to analytics endpoint

**Use case**: Analytics platforms, referral tracking.
**Complexity**: Low

#### 13. Withdrawal Alert for Specific Address

**Trigger**: Event (Withdraw on Pool)
**What it does**: Monitors withdrawals from a specific address.

**Workflow nodes**:
1. Event trigger - `Withdraw` on Pool, network `11155111`
2. Condition - `user == watched address`
3. `discord/send-message` - "Watched address withdrew funds"

**Use case**: Treasury wallet monitoring, security.
**Complexity**: Low

#### 14. Collateral Toggle Monitor

**Trigger**: Event (ReserveUsedAsCollateralDisabled on Pool)
**What it does**: Detects when a user disables an asset as collateral.

**Workflow nodes**:
1. Event trigger - `ReserveUsedAsCollateralDisabled` on Pool, network `11155111`
2. `slack/send-message` - "User disabled collateral -- position may be at risk"

**Use case**: Risk monitoring for managed wallets.
**Complexity**: Low

## Gap Analysis

### Actions KeeperHub Should Build

| Gap | What Protocol Needs | Why It Matters | Suggested Feature |
|-----|-------------------|----------------|-------------------|
| Token Approval Action | ERC20 `approve(spender, amount)` before supply/repay | Every write interaction with Aave requires a prior token approval. `write-contract` can do this but a dedicated action simplifies UX. | `web3/approve-token` with spender + amount fields |
| Multi-Call Batch Read | Reading N reserves in a single workflow step | Position snapshots need separate `read-contract` per asset (9 assets on Sepolia = 9 nodes). | `web3/multicall-read` that batches multiple view calls |
| Math/Compute Node | Arithmetic on uint256 values (dividing by 1e18, 1e27 RAY) | Health factor comes back as `1500000000000000000` -- conditions need to compare this meaningfully. | `system/compute` node for BigInt arithmetic |

### Missing Triggers & Integrations

| Gap | Current Limitation | Impact | Recommendation |
|-----|-------------------|--------|----------------|
| Price Oracle Trigger | No trigger for "when asset price crosses X" | Health factor depends on collateral prices. Price triggers enable proactive protection. | Add `Price Alert` trigger using Chainlink feeds or AaveOracle (`0x2da88497588bf89281816106C7259e31AF45a663`) |
| State Comparison Between Runs | Schedule triggers read current state but cannot compare to previous execution values | Rate change detection, utilization delta alerts need "current vs. previous" comparison | Add persistent workflow variables between executions |
| Subgraph / GraphQL Integration | No native subgraph query action | Finding liquidatable positions requires indexed data across users. `HTTP Request` partially covers this. | Native GraphQL query action |

### Platform Improvements

| Gap | Current Limitation | Impact | Recommendation |
|-----|-------------------|--------|----------------|
| Loop / Iteration Node | No way to iterate over arrays (e.g., all 9 Sepolia reserve addresses) | Reserve monitoring requires duplicating nodes for each asset | Add `for-each` node |
| BigInt Condition Comparison | Condition node may not handle 18/27 decimal uint256 comparisons correctly | Aave values like `1500000000000000000` need precise BigInt comparison | Ensure condition evaluator supports string-based BigInt |
| Multi-Step Atomic Transactions | Each `write-contract` is a separate tx | Approve-then-supply workflows can partially execute | Consider `web3/multicall-write` |
| Testnet Templates | No pre-built Aave Sepolia workflow templates | Testnet is the ideal onboarding path | Create "Aave Sepolia Health Factor Monitor" template |

### Priority Recommendations

1. **High**: Math/Compute node + BigInt condition support -- nearly every Aave automation requires converting raw uint256 values into meaningful comparisons
2. **High**: Persistent workflow state between executions -- rate change detection and yield tracking need "compare current to previous" logic
3. **Medium**: Batch/multi-call read -- 9 assets on Sepolia, 20+ on mainnet; individual reads create unwieldy workflows
4. **Medium**: Testnet workflow templates -- pre-built templates for health factor monitoring and liquidation watching
5. **Low**: Token approval UX action -- `write-contract` already handles `approve()` calls
6. **Low**: Native GraphQL/subgraph query -- `HTTP Request` covers most use cases today

## Quick Start

**Health Factor Monitor on Sepolia (read-only, no wallet needed)**:

1. Create workflow with **Schedule trigger**: `*/5 * * * *`
2. Add **`web3/read-contract`** node:
   - Network: `11155111`
   - Contract: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
   - Function: `getUserAccountData`
   - Args: `["0xYOUR_WALLET_ADDRESS"]`
3. Add **Condition**: `{{@node2:ReadContract.result.healthFactor}} < 1500000000000000000`
4. Add notification node (Discord/Telegram/Slack)

**Testing**: Use the [Aave Sepolia Faucet](https://gho.aave.com/faucet/) to mint tokens, supply via [app.aave.com](https://app.aave.com) in testnet mode, borrow to create a position, then let the workflow monitor it.

## Sources

- [Aave V3 Smart Contracts](https://aave.com/docs/aave-v3/smart-contracts)
- [Aave Pool Contract](https://aave.com/docs/aave-v3/smart-contracts/pool)
- [Aave View Contracts](https://aave.com/docs/aave-v3/smart-contracts/view-contracts)
- [AaveV3Sepolia Address Book](https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Sepolia.sol)
- [IPool Interface](https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol)
- [Aave Sepolia Faucet](https://gho.aave.com/faucet/)
