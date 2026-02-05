# Aave Safety Module Staking Monitor

## Overview

Monitor your AAVE Safety Module stake to maximize rewards and never miss withdrawal windows. Track accumulated rewards, cooldown status, and get alerted when your unstake window opens.

## Contract Details

### stkAAVE Contract Address (Ethereum Mainnet)

```
0x4da27a545c0c5B758a6BA100e3a049001de870f5
```

### Key Timing Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `COOLDOWN_SECONDS` | 864000 (10 days) | Waiting period after activating cooldown |
| `UNSTAKE_WINDOW` | 172800 (2 days) | Window to redeem after cooldown ends |

**Critical**: If you miss the 2-day unstake window, the cooldown resets and you must wait another 10 days.

---

## Read Functions (for monitoring)

### 1. Check Pending Rewards
```
Function: getTotalRewardsBalance
Input: address staker
Output: uint256 (reward amount in wei)
```

### 2. Check Staked Balance
```
Function: balanceOf
Input: address account
Output: uint256 (stkAAVE balance in wei)
```

### 3. Get Cooldown Timestamp
```
Function: stakersCooldowns
Input: address staker
Output: uint256 (unix timestamp when cooldown was activated, 0 if not active)
```

### 4. Get Cooldown Period
```
Function: COOLDOWN_SECONDS
Input: none
Output: uint256 (seconds)
```

### 5. Get Unstake Window
```
Function: UNSTAKE_WINDOW
Input: none
Output: uint256 (seconds)
```

---

## Events (for event-based triggers)

| Event | Parameters | When Emitted |
|-------|------------|--------------|
| `Staked` | from (indexed), onBehalfOf (indexed), amount | User stakes AAVE |
| `Cooldown` | user (indexed) | User activates cooldown |
| `Redeem` | from (indexed), to (indexed), amount | User unstakes AAVE |
| `RewardsAccrued` | user, amount | Rewards are accrued |
| `RewardsClaimed` | from (indexed), to (indexed), amount | User claims rewards |

---

## Minimal ABI

```json
[
  {"inputs":[{"name":"staker","type":"address"}],"name":"getTotalRewardsBalance","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"staker","type":"address"}],"name":"stakersCooldowns","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"COOLDOWN_SECONDS","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"UNSTAKE_WINDOW","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"onBehalfOf","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Staked","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"user","type":"address"}],"name":"Cooldown","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Redeem","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"RewardsAccrued","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"RewardsClaimed","type":"event"}
]
```

---

## Workflow Scenarios

### Scenario 1: Reward Threshold Alert
**Trigger**: Schedule (daily)
**Logic**:
1. Read `getTotalRewardsBalance(yourAddress)`
2. Convert from wei to AAVE (divide by 10^18)
3. If rewards > threshold, notify

**Use case**: "Alert me when I have more than 1 AAVE in claimable rewards"

---

### Scenario 2: Cooldown Window Alert
**Trigger**: Schedule (hourly during cooldown period)
**Logic**:
1. Read `stakersCooldowns(yourAddress)` -> cooldownTimestamp
2. Read `COOLDOWN_SECONDS()` -> 864000
3. Read `UNSTAKE_WINDOW()` -> 172800
4. Calculate:
   - `windowOpens = cooldownTimestamp + COOLDOWN_SECONDS`
   - `windowCloses = windowOpens + UNSTAKE_WINDOW`
5. If `now >= windowOpens && now < windowCloses`, notify "UNSTAKE WINDOW OPEN"
6. If `now >= windowCloses`, notify "WINDOW MISSED - cooldown reset"

**Use case**: "Alert me when my 2-day unstake window opens so I don't miss it"

---

### Scenario 3: Cooldown Activated (Event-Based)
**Trigger**: Event listener for `Cooldown` event
**Filter**: `user = yourAddress`
**Logic**:
1. On event, calculate when window opens (now + 10 days)
2. Send notification with exact date/time

**Use case**: "Confirm when I activate cooldown and remind me of the unlock date"

---

### Scenario 4: Stake/Unstake Tracking (Event-Based)
**Trigger**: Event listener for `Staked` or `Redeem` events
**Filter**: `from = yourAddress` or `onBehalfOf = yourAddress`
**Logic**:
1. On event, extract amount
2. Send notification with transaction details

**Use case**: "Track all staking activity on my address"

---

## Cooldown State Machine

```
[No Cooldown]
    |
    | cooldown() called
    v
[Cooldown Active] -- wait 10 days --> [Unstake Window Open] -- 2 days --> [Window Expired]
                                              |                                   |
                                              | redeem() called                   | resets to
                                              v                                   v
                                        [Unstaked]                         [No Cooldown]
```

---

## Gaps / Missing Features

_Note any missing capabilities discovered while building in the UI:_

1.
2.
3.

---

## References

- [Aave Staking Documentation](https://docs.aave.com/developers/v/2.0/protocol-governance/staking-aave)
- [stkAAVE on Etherscan](https://etherscan.io/token/0x4da27a545c0c5b758a6ba100e3a049001de870f5)
- [Safety Module Overview](https://docs.aave.com/aavenomics/safety-module)
- [aave-stake-v2 GitHub](https://github.com/aave/aave-stake-v2)
