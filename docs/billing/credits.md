# Credits

Credits are the universal currency powering all KeeperHub usage. This page explains how credits work, how to purchase them, and how they're consumed.

## How Credits Work

```
┌─────────────────────────────────────────────────────────────┐
│                    Credit Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Purchase credits via smart contract                     │
│     (ETH, USDC, USDT, or USDS)                             │
│                                                             │
│  2. Credits stored on-chain in your balance                 │
│                                                             │
│  3. Workflow runs deduct 1 credit each                      │
│                                                             │
│  4. On-chain actions convert credits → ETH at market rate   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Purchasing Credits

### Credit Packs

| Pack | Price | Credits | Effective Rate | Bonus |
|------|-------|---------|----------------|-------|
| **Starter** | $25 | 2,500 | $0.010/credit | - |
| **Growth** | $100 | 11,000 | $0.009/credit | +10% |
| **Scale** | $500 | 60,000 | $0.0083/credit | +20% |
| **Enterprise** | Custom | Custom | Custom | Negotiated |

### Accepted Tokens

- **ETH** - Converted at current market rate via Chainlink oracle
- **USDC** - 1:1 USD value
- **USDT** - 1:1 USD value
- **USDS** - 1:1 USD value (Sky Dollar)

### How to Purchase

1. Navigate to **Settings → Billing → Buy Credits**
2. Select a credit pack
3. Choose your payment token
4. Confirm the transaction in your wallet
5. Credits are added to your balance immediately

## Credit Consumption

### Workflow Runs

Every workflow execution costs **1 credit**, regardless of:

- Number of steps in the workflow
- Complexity of conditions or logic
- Time taken to execute

Internal actions (filters, routers, formatters) do not cost extra.

### On-Chain Transactions

When your workflow executes an on-chain transaction (swap, transfer, contract call, etc.):

1. Gas required is calculated based on the transaction
2. Current ETH/USD rate is fetched from Chainlink oracle
3. Credits equivalent to the gas cost are deducted
4. Transaction is executed via your org's Para wallet

**Example**: A token swap requiring 0.005 ETH in gas at $2,000/ETH = $10 = 1,000 credits

## Credit Balance

### Checking Your Balance

View your credit balance at **Settings → Billing** or in the header navigation.

### Low Balance Warnings

When your balance drops below 100 credits, you'll see a warning notification. Workflows will pause when credits reach zero.

### Balance Alerts

Configure alerts at **Settings → Notifications**:

- Low balance threshold (default: 100 credits)
- Zero balance notification
- Weekly usage summary

## Smart Contract

Credits are managed by the KeeperHub Credits smart contract:

- **Balances**: Stored on-chain per wallet address
- **Deposits**: Emit `CreditsPurchased` event
- **Burns**: Only the KeeperHub relayer can burn credits
- **Transparency**: All transactions visible on-chain

### Contract Functions

```solidity
// View your balance
function balanceOf(address org) external view returns (uint256);

// Deposit stablecoins for credits
function depositStable(address token, uint256 amount) external;

// Deposit ETH for credits (converted at market rate)
function depositETH() external payable;
```

## FAQ

### What if I run out of credits mid-workflow?

The workflow will fail at the step requiring credits. Any on-chain transactions already submitted will complete, but subsequent steps will not execute.

### Can I transfer credits between organizations?

Not currently. Credits are bound to the organization that purchased them.

### Do unused credits expire?

No. Credits never expire.

### How is the ETH/USD rate determined?

We use Chainlink price feeds for accurate, manipulation-resistant pricing. The rate is fetched at the moment of transaction execution.

### Can I get a refund for unused credits?

No. All credit purchases are final. We recommend starting with the Starter pack to gauge your usage before purchasing larger packs.
