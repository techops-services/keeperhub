---
title: "Chains API"
description: "KeeperHub Chains API - list supported blockchain networks and fetch contract ABIs."
---

# Chains API

Access supported blockchain networks and contract information.

## List Chains

```http
GET /api/chains
```

Returns all supported blockchain networks.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeDisabled` | boolean | Include disabled chains (default: false) |

### Response

```json
{
  "data": [
    {
      "id": "chain_1",
      "chainId": 1,
      "name": "Ethereum Mainnet",
      "symbol": "ETH",
      "chainType": "evm",
      "defaultPrimaryRpc": "https://...",
      "defaultFallbackRpc": "https://...",
      "explorerUrl": "https://etherscan.io",
      "explorerApiUrl": "https://api.etherscan.io",
      "isTestnet": false,
      "isEnabled": true
    },
    {
      "id": "chain_2",
      "chainId": 11155111,
      "name": "Sepolia",
      "symbol": "ETH",
      "chainType": "evm",
      "isTestnet": true,
      "isEnabled": true
    }
  ]
}
```

### Chain Types

| Type | Description |
|------|-------------|
| `evm` | Ethereum Virtual Machine compatible |
| `solana` | Solana network |

## Fetch Contract ABI

```http
GET /api/chains/{chainId}/abi?address={contractAddress}
```

Fetches the ABI for a verified contract from the block explorer.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Contract address (required) |

### Response

```json
{
  "abi": [
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [{"name": "account", "type": "address"}],
      "outputs": [{"name": "", "type": "uint256"}]
    }
  ]
}
```

## Alternative ABI Fetch

```http
GET /api/web3/fetch-abi?address={address}&chainId={chainId}
```

Alternative endpoint for fetching contract ABIs.
