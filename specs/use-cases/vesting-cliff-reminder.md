# Vesting Cliff Reminder - Use Case Requirements

## Overview

**Goal**: Monitor token vesting contracts and notify users when tokens become claimable.

**User Story**: As a token holder with vesting schedules, I want to be notified when my tokens unlock so I don't miss vesting cliffs.

---

## Recommended Protocol: Sablier

Sablier is the most widely adopted token vesting protocol (since 2019), deployed on 20+ EVM chains.

### Contract Addresses (Sablier V3 - October 2025)

| Network   | Chain ID | SablierLockup Address                        |
|-----------|----------|----------------------------------------------|
| Ethereum  | 1        | `0xcF8ce57fa442ba50aCbC57147a62aD03873FfA73` |
| Arbitrum  | 42161    | `0xF12AbfB041b5064b839Ca56638cDB62fEA712Db5` |
| Polygon   | 137      | `0x1E901b0E05A78C011D6D4cfFdBdb28a42A1c32EF` |
| Base      | 8453     | `0xe261b366f231b12fcb58d6bbd71e57faee82431d` |
| Optimism  | 10       | `0xe2620fB20fC9De61CD207d921691F4eE9d0fffd0` |
| Avalanche | 43114    | `0x7e146250Ed5CCCC6Ada924D456947556902acaFD` |

---

## Required Contract Functions

Use these with the **Read Contract** action:

### 1. Check Claimable Amount
```
Function: withdrawableAmountOf
Input: uint256 streamId
Output: uint128 withdrawableAmount
```

### 2. Get Cliff Time (Linear streams only)
```
Function: getCliffTime
Input: uint256 streamId
Output: uint40 cliffTime (unix timestamp)
```

### 3. Check Stream Status
```
Function: statusOf
Input: uint256 streamId
Output: uint8 status
```
Status codes: 0=PENDING, 1=STREAMING, 2=SETTLED, 3=CANCELED, 4=DEPLETED

### 4. Get Vesting Schedule
```
Function: getStartTime / getEndTime
Input: uint256 streamId
Output: uint40 timestamp
```

### 5. Get Token Details
```
Function: getAsset
Input: uint256 streamId
Output: address (token contract)
```

### 6. Get Amounts
```
Function: getDepositedAmount / getWithdrawnAmount / streamedAmountOf
Input: uint256 streamId
Output: uint128 amount (in token's smallest unit)
```

---

## Minimal ABI for Sablier Lockup

```json
[
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"withdrawableAmountOf","outputs":[{"name":"withdrawableAmount","type":"uint128"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"streamedAmountOf","outputs":[{"name":"streamedAmount","type":"uint128"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getDepositedAmount","outputs":[{"name":"depositedAmount","type":"uint128"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getWithdrawnAmount","outputs":[{"name":"withdrawnAmount","type":"uint128"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getStartTime","outputs":[{"name":"startTime","type":"uint40"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getEndTime","outputs":[{"name":"endTime","type":"uint40"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getCliffTime","outputs":[{"name":"cliffTime","type":"uint40"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"statusOf","outputs":[{"name":"status","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getAsset","outputs":[{"name":"asset","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getSender","outputs":[{"name":"sender","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"streamId","type":"uint256"}],"name":"getRecipient","outputs":[{"name":"recipient","type":"address"}],"stateMutability":"view","type":"function"}
]
```

---

## Workflow Design

### Trigger Options
- [ ] **Scheduled/Cron**: Check vesting status on a schedule (daily, hourly)
- [ ] **Manual**: User triggers check on demand
- [ ] **Event-based**: Listen for blockchain events (advanced)

### Steps
1. **Read Contract** - Call `withdrawableAmountOf(streamId)` to get claimable amount
2. **Condition** - Check if amount > 0 (or above threshold)
3. **Read Contract** - (Optional) Get additional details like cliff time, status
4. **Notify** - Send Discord/Telegram/Email notification

### Notification Content
- Stream ID
- Claimable amount (formatted with token symbol)
- Cliff status (passed/pending)
- Link to claim (Sablier app URL)

---

## Testing Notes

**How to get a Stream ID:**
- Check your wallet on [app.sablier.com](https://app.sablier.com)
- Each vesting stream is an NFT - the token ID is your stream ID
- Can also find via Etherscan by checking NFT holdings of the Sablier contract

---

## Gaps / Missing Features (To Fill In)

_Note any missing capabilities discovered while building in the UI:_

1.
2.
3.

---

## References

- [Sablier Documentation](https://docs.sablier.com)
- [Sablier Deployment Addresses](https://docs.sablier.com/guides/lockup/deployments)
- [Sablier App](https://app.sablier.com)
- [SablierLockup Contract Reference](https://docs.sablier.com/reference/lockup/contracts/contract.SablierLockup)
