# Yield Harvesting Templates Roadmap

Auto-claim and yield harvesting workflow templates that work with existing nodes (Read Contract, Write Contract, Condition, Schedule Trigger).

---

## Ethereum Mainnet

### 1. Lido stETH Rewards Monitor

Lido doesn't require claiming (stETH rebases automatically), but you could build a "weekly yield report" that reads your stETH balance growth and sends a notification with accrued ETH rewards.

- **Token:** stETH
- **Pattern:** Read-only monitoring + notification
- **Complexity:** Low

---

### 2. Aave V3 USDC/USDT Yield Harvester

Claim accrued rewards from Aave V3 lending positions.

- **Contract:** Aave Rewards Controller `0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb`
- **Function:** `claimAllRewards(address[] assets, address to)`
- **Pattern:** Users deposit USDC/USDT, earn interest + potential token rewards
- **Complexity:** Medium

---

### 3. Compound V3 USDC Rewards Claimer

Claim COMP token rewards from Compound V3 USDC market.

- **Contract:** CometRewards `0x1B0e765F6224C21223AeA2af16c1C46E38885a40`
- **Function:** `claim(address comet, address src, bool shouldAccrue)`
- **Comet (USDC):** `0xc3d688B66703497DAA19211EEdff47f25384cdc3`
- **Complexity:** Medium

---

### 4. Curve/Convex LP Rewards Claimer

Claim CRV + CVX rewards from staked Curve LP positions.

- **Contract:** Convex Booster `0xF403C135812408BFbE8713b5A23a04b3D48AAE31`
- **Function:** `earmarkRewards(uint256 poolId)` then claim from reward contracts
- **Pattern:** LP staking rewards
- **Complexity:** High (multiple contracts involved)

---

### 5. Eigenlayer Restaking Rewards

Claim restaking rewards from Eigenlayer positions (when rewards go live).

- **Status:** Pending — rewards mechanism not yet fully live
- **Pattern:** Would follow similar claim pattern once available
- **Complexity:** TBD

---

## Base

### 6. Aerodrome LP Rewards Claimer

Aerodrome is the main DEX on Base (Velodrome fork). Claim AERO token rewards from staked LP positions.

- **Contract:** Gauge contracts (varies per pool)
- **Function:** `getReward(address account)`
- **Token:** AERO
- **Complexity:** Medium
- **Priority:** High — Base is supported, Aerodrome is dominant DEX

---

### 7. Moonwell USDC Lending Rewards

Claim WELL token rewards from Moonwell lending on Base.

- **Contract:** Comptroller `0xfBb21d0380beE3312B33c4353c8936a0F13EF26C`
- **Pattern:** Similar to Compound — deposit USDC, earn interest + WELL
- **Token:** WELL
- **Complexity:** Medium

---

### 8. Extra Finance Yield Harvester

Leveraged yield farming on Base. Claim rewards from lending/farming positions.

- **Pattern:** Leveraged yield farming rewards
- **Complexity:** High

---

## Polygon

### 9. Aave V3 Polygon Rewards Claimer

Same pattern as Ethereum Aave but on Polygon (cheaper gas).

- **Contract:** Rewards Controller `0x929EC64c34a17401F460460D4B9390518E5B473e`
- **Function:** `claimAllRewards(address[] assets, address to)`
- **Advantage:** Much lower gas costs than Ethereum mainnet
- **Complexity:** Medium

---

### 10. QuickSwap Dragon's Lair (dQUICK) Rewards

Stake QUICK, earn more QUICK.

- **Pattern:** Similar staking rewards pattern
- **Token:** QUICK
- **Complexity:** Low

---

## Arbitrum

### 11. GMX Staking Rewards Claimer

Claim esGMX + ETH rewards from staked GMX.

- **Contract:** RewardRouter `0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1`
- **Function:** `claimAll()` or `claim()`
- **Rewards:** esGMX + ETH/AVAX
- **Complexity:** Medium

---

### 12. Radiant Capital Rewards Claimer

Claim RDNT emissions from lending positions.

- **Pattern:** MultiFeeDistribution contract pattern
- **Token:** RDNT
- **Complexity:** Medium

---

## Recommended Priority

| Priority | Template | Network | Rationale |
|----------|----------|---------|-----------|
| 1 | Aerodrome LP Rewards | Base | Base already supported, dominant DEX, common use case |
| 2 | Aave V3 Rewards | Ethereum | Huge TVL, well-documented, standard pattern |
| 3 | Compound V3 USDC | Ethereum | Large user base, similar to Aave |
| 4 | Moonwell Rewards | Base | Leverages Base support, growing protocol |
| 5 | Aave V3 Polygon | Polygon | Same as Ethereum Aave but cheaper gas |
| 6 | GMX Staking | Arbitrum | Popular protocol, straightforward claim |

---

## Common Workflow Pattern

All these templates follow roughly the same structure:

```
[Schedule Trigger: Weekly Cron]
    |
[Read Contract: Check pending/earned rewards]
    |
[Condition: rewards > threshold]
    |
[Write Contract: Claim rewards]
    |
[Check Token Balance: Verify receipt]
    |
[Send Notification: Report claimed amount]
```

The main differences between templates are:
- Contract addresses and ABIs
- Function signatures for checking and claiming
- Whether authorization (like Sky's `hope()`) is required
- Network and gas considerations
