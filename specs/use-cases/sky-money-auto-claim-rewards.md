# Sky.money Auto-Claim USDS Rewards Template

## Overview

Automate weekly claiming of USDS rewards from SKY staking on Sky.money (formerly MakerDAO). The workflow runs on a schedule, checks pending rewards, claims them to the org wallet, and sends a notification summary.

## Sky Protocol Staking Architecture

Sky Protocol has two distinct staking paths:

| Path | Action | Earn | Contract |
|------|--------|------|----------|
| **A** | Stake USDS | Earn SKY | `0x0650CAf159C5A49f711e8169D4336ECB9b950275` |
| **B** | Stake SKY | Earn USDS | Via LockStakeEngine `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3` |

This template targets **Path B** -- stake SKY, earn USDS.

Users do not interact with the rewards farm directly. Everything goes through the **LockStakeEngine**, which manages "urn" positions. The underlying mechanism is a modified Synthetix StakingRewards pattern with the engine as an intermediary.

### How It Works

1. User locks SKY into the LockStakeEngine, creating a vault position (urn)
2. The engine converts SKY into internal lsSKY tokens and deposits them into the USDS rewards farm
3. USDS rewards accrue over time (funded by the protocol Surplus Buffer)
4. User calls `getReward()` on the engine to claim USDS to their wallet

## Contract Addresses (Ethereum Mainnet)

| Contract | Address |
|----------|---------|
| SKY Token | `0x56072C95FAA701256059aa122697B133aDEd9279` |
| USDS Token | `0xdC035D45d973E3EC169d2276DDab16f1e407384F` |
| LockStakeEngine | `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3` |
| USDS Rewards Farm (REWARDS_LSSKY_USDS) | `0x38E4254bD82ED5Ee97CD1C4278FAae748d998865` |
| lsSKY Token (internal) | `0xf9A9cfD3229E985B91F99Bc866d42938044FFa1C` |

## Key ABI Functions

### LockStakeEngine (`0xCe01C90d...`)

**View functions:**

```solidity
// Get the urn address for a user's position
function ownerUrns(address owner, uint256 index) external view returns (address urn)

// Get how many positions a user has
function ownerUrnsCount(address owner) external view returns (uint256)

// Check which farm an urn is using
function urnFarms(address urn) external view returns (address)
```

**Write functions:**

```solidity
// Claim USDS rewards
function getReward(
    address owner,    // wallet address
    uint256 index,    // urn index (usually 0 for first position)
    address farm,     // 0x38E4254bD82ED5Ee97CD1C4278FAae748d998865
    address to        // recipient address for USDS
) external returns (uint256 amt)
```

### USDS Rewards Farm (`0x38E4254...`)

```solidity
// Check pending rewards for an urn address (NOT wallet address)
function earned(address account) public view returns (uint256)

// Check staked lsSKY balance for an urn
function balanceOf(address account) external view returns (uint256)

// Global stats
function rewardRate() external view returns (uint256)
function totalSupply() external view returns (uint256)
```

## Authorization Model

The workflow engine sends transactions from the **Para org wallet**, but the staking position is owned by the **user's personal wallet** (the address they used to stake SKY on sky.money). These are two different addresses.

The LockStakeEngine requires that any address calling write functions on a position must be either:
- The position owner (the personal wallet), or
- An address explicitly granted permission via `hope()`

Since the Para wallet is not the position owner, it needs to be authorized before the workflow can claim rewards.

### One-Time Setup (Manual, Outside the Workflow)

The user must call `hope()` on the LockStakeEngine from their personal wallet to grant the Para org wallet permission to act on their staking position:

```solidity
// Called from the user's personal wallet (e.g. MetaMask)
// On LockStakeEngine: 0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3
function hope(address usr) external
```

- `usr`: the Para org wallet address

This only needs to be done once. After this, the Para wallet can call `getReward()` on behalf of the user.

### Address Roles in the Workflow

| Role | Address | Used In |
|------|---------|---------|
| **Position Owner** | User's personal wallet (staked SKY on sky.money) | Read steps: lookups and reward queries |
| **Transaction Sender** | Para org wallet (sends the on-chain tx) | Write steps: the `msg.sender` of the claim tx |
| **Reward Recipient** | User's personal wallet OR Para wallet (configurable via `to` arg) | Where claimed USDS lands |

## Workflow Template (v1: Claim + Notify)

```
[Schedule Trigger: Weekly Cron (0 0 * * 1)]
    |
[Read Contract: LockStakeEngine.ownerUrns(personalWallet, 0)]
    --> outputs: urn address
    |
[Read Contract: RewardsFarm.earned({{urnAddress}})]
    --> outputs: pending USDS amount (wei)
    |
[Write Contract: LockStakeEngine.getReward(personalWallet, 0, farm, recipientAddress)]
    --> sent by Para wallet, claims USDS rewards
    |
[Check Token Balance: USDS on recipient]
    --> confirms receipt
    |
[Send Notification: "Claimed {{balance}} USDS from Sky staking"]
```

### Node Configuration Details

**Step 1 -- Get Urn Address (Read Contract)**
- Network: Ethereum Mainnet
- Contract: `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3`
- Function: `ownerUrns(address,uint256)`
- Args: `[personalWalletAddress, 0]`
- Note: `personalWalletAddress` is the user's own wallet that owns the Sky staking position, NOT the Para org wallet

**Step 2 -- Check Pending Rewards (Read Contract)**
- Network: Ethereum Mainnet
- Contract: `0x38E4254bD82ED5Ee97CD1C4278FAae748d998865`
- Function: `earned(address)`
- Args: `[{{Step1.result}}]` (urn address from previous step)

**Step 3 -- Claim Rewards (Write Contract)**
- Network: Ethereum Mainnet
- Contract: `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3`
- Function: `getReward(address,uint256,address,address)`
- Args:
  - `owner`: `personalWalletAddress` (position owner, NOT the Para wallet)
  - `index`: `0`
  - `farm`: `0x38E4254bD82ED5Ee97CD1C4278FAae748d998865`
  - `to`: recipient address for USDS (can be the personal wallet or the Para wallet)
- Transaction sent by: Para org wallet (must have `hope()` authorization)

**Step 4 -- Verify Balance (Check Token Balance)**
- Network: Ethereum Mainnet
- Token: USDS (`0xdC035D45d973E3EC169d2276DDab16f1e407384F`)
- Address: same address used as `to` in Step 3

**Step 5 -- Notify (Discord/Telegram/Email)**
- Message: "Claimed {{Step3.result}} USDS from Sky.money staking. Tx: {{Step3.transactionLink}}"

## Prerequisites

- SKY token needs to be added to the seeded token registry
- User must have an existing SKY staking position (urn) on Sky.money
- User must call `hope(paraWalletAddress)` on the LockStakeEngine from their personal wallet (one-time setup to authorize the Para wallet)
- The workflow needs the user's personal wallet address as an input/config value

## Future Enhancement (v2: Full Compound)

To enable automatic restaking (USDS -> SKY -> restake), requires:

1. **Swap Token step** -- DEX integration (Uniswap V3 / 1inch) to swap claimed USDS to SKY
2. **Write Contract** -- Call `LockStakeEngine.lock()` to restake SKY
3. **Conditional node** -- Skip execution if pending rewards are below gas threshold
4. **ERC20 Approve step** -- Approve LockStakeEngine to spend SKY before restaking

## Sources

- [Sky Protocol Developer Docs - Staking Engine](https://developers.sky.money/protocol/rewards/staking-engine/)
- [Sky Protocol Developer Docs - Key Information](https://developers.sky.money/guides/sky/token-governance-upgrade/key-info/)
- [GitHub - sky-ecosystem/lockstake](https://github.com/sky-ecosystem/lockstake)
- [GitHub - sky-ecosystem/endgame-toolkit](https://github.com/sky-ecosystem/endgame-toolkit)
