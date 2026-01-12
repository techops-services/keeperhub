---
title: "Para Wallet Integration"
description: "How KeeperHub integrates with Para for secure, simplified wallet management without handling private keys."
---

# Para Integration

KeeperHub uses Para for secure wallet management, eliminating the need for users to handle private keys or complex wallet security procedures.

## Automatic Wallet Creation

When you create a new KeeperHub account, a Para wallet is automatically generated and associated with your account. The public address is displayed in the KeeperHub interface for reference.

## Wallet Funding

Topping up your Para wallet with ETH is only required for specific keeper operations:

**When funding is needed**:
- Write function calls from Poker keepers (require gas fees)
- Filler keeper operations that transfer ETH to other wallets
- Any keeper operations that execute blockchain transactions

**When funding is not needed**:
- Watcher keepers (read-only monitoring)
- Multisig keepers (monitoring multisig changes)
- Read function calls from Poker keepers

Balance updates are reflected in the KeeperHub interface and displayed per network (Mainnet/Sepolia).

## Wallet Management

**Deposit**: Transfer ETH to your Para wallet address to fund keeper operations.

**Withdraw**: Use the Withdraw function in the UI to transfer wallet balance out of KeeperHub.

## Security Benefits

**No Private Key Management**: Para handles all cryptographic operations securely without exposing private keys to users.

**Simplified Experience**: Users don't need prior knowledge of Ethereum wallet management or security best practices.

**Integrated Operations**: Seamless integration with keeper functions for automated transactions.

## Supported Operations

Para wallets can execute:
- ETH transfers for Filler keeper operations
- Smart contract function calls for Poker keeper operations
- Gas fee payments for all transaction-based keepers

## Network Support

Currently supports:
- Ethereum Mainnet
- Sepolia Testnet

## Limitations

Token transfers are not yet supported but are planned for future releases.