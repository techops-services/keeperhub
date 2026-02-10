# KeeperHub Smart Contract Specification

## Overview

Two smart contracts power the KeeperHub billing system:
1. **KeeperHubTiers** - Soulbound NFT for tier access
2. **KeeperHubCredits** - Credit balance management

## Contract Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    KeeperHub Billing System                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   KeeperHubTiers (ERC-721 Soulbound)                          │
│   ─────────────────────────────────                           │
│   • Mint tier NFT (Developer/Team/Company/Enterprise)         │
│   • Annual or Lifetime variants                               │
│   • Non-transferable (soulbound)                              │
│   • Expiry checking for annual NFTs                           │
│                                                                │
│   KeeperHubCredits                                            │
│   ────────────────                                            │
│   • Accept deposits (ETH, USDC, USDT, USDS)                   │
│   • Track credit balances per organization                    │
│   • Burn credits for workflow runs                            │
│   • Convert credits to ETH for gas at market rate             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## KeeperHubTiers Contract

### State

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KeeperHubTiers is ERC721, Ownable {
    enum Tier { Developer, Team, Company, Enterprise }

    struct TierNFT {
        Tier tier;
        bool isLifetime;
        uint256 expiresAt;    // 0 for lifetime
        uint256 mintedAt;
    }

    // Tier pricing in USD (6 decimals for stablecoin compatibility)
    struct TierPricing {
        uint256 annualPrice;
        uint256 lifetimePrice;
    }

    mapping(uint256 => TierNFT) public tierData;
    mapping(address => uint256) public orgToTokenId;
    mapping(Tier => TierPricing) public tierPricing;

    uint256 private _nextTokenId;

    // Accepted payment tokens
    IERC20 public usdc;
    IERC20 public usdt;
    IERC20 public usds;

    // Chainlink price feed for ETH/USD
    AggregatorV3Interface public ethUsdFeed;
}
```

### Pricing Configuration

```solidity
// Prices in USD with 6 decimals (stablecoin format)
tierPricing[Tier.Developer] = TierPricing({
    annualPrice: 0,           // Free
    lifetimePrice: 99_000000  // $99
});

tierPricing[Tier.Team] = TierPricing({
    annualPrice: 225_000000,  // $225/year
    lifetimePrice: 675_000000 // $675
});

tierPricing[Tier.Company] = TierPricing({
    annualPrice: 675_000000,  // $675/year
    lifetimePrice: 2025_000000 // $2,025
});

// Enterprise is custom, handled off-chain
```

### Core Functions

```solidity
/// @notice Mint a tier NFT for an organization
/// @param tier The tier to mint (Developer, Team, Company)
/// @param isLifetime True for lifetime, false for annual
/// @param paymentToken Address of payment token (address(0) for ETH)
function mintTier(
    Tier tier,
    bool isLifetime,
    address paymentToken
) external payable {
    require(orgToTokenId[msg.sender] == 0, "Already has tier");
    require(tier != Tier.Enterprise, "Contact sales for Enterprise");

    uint256 price = isLifetime
        ? tierPricing[tier].lifetimePrice
        : tierPricing[tier].annualPrice;

    if (price > 0) {
        _collectPayment(price, paymentToken);
    }

    uint256 tokenId = _nextTokenId++;
    _safeMint(msg.sender, tokenId);

    tierData[tokenId] = TierNFT({
        tier: tier,
        isLifetime: isLifetime,
        expiresAt: isLifetime ? 0 : block.timestamp + 365 days,
        mintedAt: block.timestamp
    });

    orgToTokenId[msg.sender] = tokenId;

    emit TierMinted(msg.sender, tier, isLifetime, tokenId);
}

/// @notice Renew an annual tier NFT
/// @param paymentToken Address of payment token
function renewTier(address paymentToken) external payable {
    uint256 tokenId = orgToTokenId[msg.sender];
    require(tokenId != 0, "No tier to renew");

    TierNFT storage nft = tierData[tokenId];
    require(!nft.isLifetime, "Lifetime NFT does not need renewal");

    uint256 price = tierPricing[nft.tier].annualPrice;
    _collectPayment(price, paymentToken);

    nft.expiresAt = block.timestamp + 365 days;

    emit TierRenewed(msg.sender, nft.tier, tokenId);
}

/// @notice Check if an organization has valid tier access
/// @param org Organization wallet address
/// @return tier The tier level
/// @return valid Whether the tier is currently valid
function checkAccess(address org) external view returns (Tier tier, bool valid) {
    uint256 tokenId = orgToTokenId[org];
    if (tokenId == 0) {
        return (Tier.Developer, true); // Default to free tier
    }

    TierNFT memory nft = tierData[tokenId];
    bool isValid = nft.isLifetime || block.timestamp < nft.expiresAt;

    return (nft.tier, isValid);
}

/// @notice Soulbound: prevent transfers
function _update(
    address to,
    uint256 tokenId,
    address auth
) internal override returns (address) {
    address from = _ownerOf(tokenId);
    require(from == address(0), "Soulbound: transfer not allowed");
    return super._update(to, tokenId, auth);
}
```

### Events

```solidity
event TierMinted(address indexed org, Tier tier, bool isLifetime, uint256 tokenId);
event TierRenewed(address indexed org, Tier tier, uint256 tokenId);
event TierUpgraded(address indexed org, Tier fromTier, Tier toTier);
```

## KeeperHubCredits Contract

### State

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract KeeperHubCredits is Ownable {
    // Credit balances per organization
    mapping(address => uint256) public credits;

    // Accepted stablecoins
    IERC20 public usdc;
    IERC20 public usdt;
    IERC20 public usds;

    // Chainlink price feed for ETH/USD
    AggregatorV3Interface public ethUsdFeed;

    // Authorized relayer for burning credits
    address public relayer;

    // Credit pack definitions (credits per dollar, with bonus)
    // Pack 1: $25 = 2,500 credits (1:100)
    // Pack 2: $100 = 11,000 credits (1:110, +10%)
    // Pack 3: $500 = 60,000 credits (1:120, +20%)

    uint256 public constant CREDITS_PER_DOLLAR_BASE = 100;
    uint256 public constant BONUS_TIER_2 = 110; // 10% bonus
    uint256 public constant BONUS_TIER_3 = 120; // 20% bonus

    uint256 public constant TIER_2_THRESHOLD = 100_000000; // $100
    uint256 public constant TIER_3_THRESHOLD = 500_000000; // $500

    // New org bonus
    uint256 public constant NEW_ORG_BONUS = 2500; // 2,500 credits for new orgs
}
```

### Core Functions

```solidity
/// @notice Deposit stablecoins for credits
/// @param token Address of stablecoin (USDC, USDT, or USDS)
/// @param amount Amount in token decimals (6 for USDC/USDT, 18 for USDS)
function depositStable(address token, uint256 amount) external {
    require(
        token == address(usdc) ||
        token == address(usdt) ||
        token == address(usds),
        "Invalid token"
    );

    IERC20(token).transferFrom(msg.sender, address(this), amount);

    // Normalize to 6 decimals for USD value
    uint256 usdValue = _normalizeToUsd(token, amount);
    uint256 creditsToMint = _calculateCredits(usdValue);

    credits[msg.sender] += creditsToMint;

    emit CreditsDeposited(msg.sender, token, amount, creditsToMint);
}

/// @notice Deposit ETH for credits (converted at market rate)
function depositETH() external payable {
    require(msg.value > 0, "No ETH sent");

    uint256 usdValue = _ethToUsd(msg.value);
    uint256 creditsToMint = _calculateCredits(usdValue);

    credits[msg.sender] += creditsToMint;

    emit CreditsDeposited(msg.sender, address(0), msg.value, creditsToMint);
}

/// @notice Burn credits for workflow run (1 credit per run)
/// @param org Organization wallet address
/// @param runs Number of workflow runs
function burnForRun(address org, uint256 runs) external onlyRelayer {
    require(credits[org] >= runs, "Insufficient credits");
    credits[org] -= runs;

    emit CreditsBurned(org, runs, "workflow_run");
}

/// @notice Burn credits for gas (convert to ETH at market rate)
/// @param org Organization wallet address
/// @param ethAmount Amount of ETH needed for gas
/// @return creditsUsed Number of credits burned
function burnForGas(address org, uint256 ethAmount) external onlyRelayer returns (uint256) {
    uint256 usdValue = _ethToUsd(ethAmount);
    uint256 creditsNeeded = usdValue / 10000; // 1 credit = $0.01 = 10000 in 6 decimals

    require(credits[org] >= creditsNeeded, "Insufficient credits for gas");
    credits[org] -= creditsNeeded;

    emit CreditsBurned(org, creditsNeeded, "gas");

    return creditsNeeded;
}

/// @notice Grant new organization bonus credits
/// @param org Organization wallet address
function grantNewOrgBonus(address org) external onlyOwner {
    require(credits[org] == 0, "Org already has credits");
    credits[org] = NEW_ORG_BONUS;

    emit NewOrgBonus(org, NEW_ORG_BONUS);
}

/// @notice Get current credit balance
/// @param org Organization wallet address
function balanceOf(address org) external view returns (uint256) {
    return credits[org];
}

/// @notice Calculate ETH value of credits (for gas estimation)
/// @param creditAmount Number of credits
/// @return ethAmount Equivalent ETH amount
function creditsToEth(uint256 creditAmount) external view returns (uint256) {
    uint256 usdValue = creditAmount * 10000; // 1 credit = $0.01
    return _usdToEth(usdValue);
}
```

### Internal Functions

```solidity
/// @notice Calculate credits from USD value with bonus tiers
function _calculateCredits(uint256 usdValue) internal pure returns (uint256) {
    uint256 multiplier;

    if (usdValue >= TIER_3_THRESHOLD) {
        multiplier = BONUS_TIER_3;
    } else if (usdValue >= TIER_2_THRESHOLD) {
        multiplier = BONUS_TIER_2;
    } else {
        multiplier = CREDITS_PER_DOLLAR_BASE;
    }

    // usdValue is in 6 decimals, divide to get whole dollars
    return (usdValue * multiplier) / 1_000000;
}

/// @notice Convert ETH to USD using Chainlink oracle
function _ethToUsd(uint256 ethAmount) internal view returns (uint256) {
    (, int256 price, , , ) = ethUsdFeed.latestRoundData();
    require(price > 0, "Invalid price feed");

    // price has 8 decimals, ethAmount has 18 decimals
    // result should have 6 decimals for USD
    return (ethAmount * uint256(price)) / 1e20;
}

/// @notice Convert USD to ETH using Chainlink oracle
function _usdToEth(uint256 usdValue) internal view returns (uint256) {
    (, int256 price, , , ) = ethUsdFeed.latestRoundData();
    require(price > 0, "Invalid price feed");

    // Reverse conversion
    return (usdValue * 1e20) / uint256(price);
}

/// @notice Normalize token amount to 6 decimal USD value
function _normalizeToUsd(address token, uint256 amount) internal view returns (uint256) {
    if (token == address(usds)) {
        // USDS has 18 decimals, convert to 6
        return amount / 1e12;
    }
    // USDC and USDT have 6 decimals
    return amount;
}
```

### Events

```solidity
event CreditsDeposited(address indexed org, address token, uint256 amount, uint256 credits);
event CreditsBurned(address indexed org, uint256 credits, string reason);
event NewOrgBonus(address indexed org, uint256 credits);
```

## App Integration Changes

### Database Schema

```sql
-- Add credit tracking to organizations table
ALTER TABLE organizations ADD COLUMN credit_balance INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN tier VARCHAR(20) DEFAULT 'developer';
ALTER TABLE organizations ADD COLUMN tier_expires_at TIMESTAMP;
ALTER TABLE organizations ADD COLUMN tier_is_lifetime BOOLEAN DEFAULT FALSE;

-- Credit transaction history
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    type VARCHAR(20) NOT NULL, -- 'deposit', 'workflow_run', 'gas'
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    tx_hash VARCHAR(66), -- On-chain transaction hash
    created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow run tracking for rate limiting
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    workflow_id UUID REFERENCES workflows(id),
    credits_used INTEGER DEFAULT 1,
    gas_credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

```typescript
// GET /api/billing/balance
// Returns current credit balance and tier info

// POST /api/billing/deposit
// Webhook from smart contract for credit deposits

// GET /api/billing/usage
// Returns usage history and stats

// POST /api/billing/estimate
// Estimate credits needed for a workflow
```

### Rate Limiting Logic

```typescript
// Check rate limit before workflow execution
async function checkRateLimit(orgId: string): Promise<boolean> {
  const org = await getOrganization(orgId);
  const tier = getTierLimits(org.tier);

  const runsLastHour = await countRunsInLastHour(orgId);

  if (runsLastHour >= tier.rateLimit) {
    // Queue the run or return error
    return false;
  }

  return true;
}

// Tier limits
const TIER_LIMITS = {
  developer: { workflows: 5, rateLimit: 5, users: 1, orgs: 1 },
  team: { workflows: 50, rateLimit: 20, users: 5, orgs: 2 },
  company: { workflows: Infinity, rateLimit: 50, users: 25, orgs: 5 },
  enterprise: { workflows: Infinity, rateLimit: Infinity, users: Infinity, orgs: Infinity }
};
```

### UI Components

```typescript
// Upgrade prompt modal
interface UpgradePromptProps {
  limitType: 'workflow' | 'rate' | 'credits';
  currentTier: Tier;
  message: string;
}

// Low credit warning banner
interface CreditWarningProps {
  balance: number;
  threshold: number; // Default 100
}

// Credit purchase flow
interface CreditPurchaseProps {
  packs: CreditPack[];
  onPurchase: (pack: CreditPack, token: PaymentToken) => void;
}
```

## Deployment

### Contract Deployment Order

1. Deploy `KeeperHubCredits` contract
2. Deploy `KeeperHubTiers` contract
3. Configure price feeds and accepted tokens
4. Set relayer address for credit burning
5. Verify contracts on block explorer

### Supported Networks

- Ethereum Mainnet (primary)
- Base (L2 for lower gas)
- Arbitrum (L2 alternative)

### Security Considerations

1. **Audit Required**: Both contracts should be audited before mainnet deployment
2. **Access Control**: Only authorized relayer can burn credits
3. **Price Feed**: Use Chainlink for manipulation-resistant pricing
4. **Reentrancy**: Follow checks-effects-interactions pattern
5. **Overflow**: Use Solidity 0.8+ for built-in overflow protection
