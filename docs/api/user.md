---
title: "User API"
description: "KeeperHub User API - manage user profile, wallet, and RPC preferences."
---

# User API

Manage user profile and preferences.

## Get User Profile

```http
GET /api/user
```

### Response

```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://...",
  "isAnonymous": false,
  "providerId": "google",
  "walletAddress": "0x..."
}
```

## Update User Profile

```http
PATCH /api/user
```

Note: OAuth users cannot update email or name.

### Request Body

```json
{
  "name": "New Name"
}
```

## Get User Wallet

```http
GET /api/user/wallet
```

Returns the user's Para wallet information.

### Response

```json
{
  "address": "0x...",
  "balances": {
    "1": "1.5",
    "11155111": "0.1"
  }
}
```

## RPC Preferences

Manage custom RPC endpoints per chain.

### List RPC Preferences

```http
GET /api/user/rpc-preferences
```

### Response

```json
{
  "data": [
    {
      "chainId": 1,
      "primaryRpc": "https://custom-rpc.example.com",
      "fallbackRpc": "https://fallback.example.com"
    }
  ]
}
```

### Set RPC Preferences

```http
POST /api/user/rpc-preferences
```

### Request Body

```json
{
  "chainId": 1,
  "primaryRpc": "https://custom-rpc.example.com",
  "fallbackRpc": "https://fallback.example.com"
}
```

### Get Chain RPC Preference

```http
GET /api/user/rpc-preferences/{chainId}
```

### Update Chain RPC Preference

```http
PUT /api/user/rpc-preferences/{chainId}
```

### Delete Chain RPC Preference

```http
DELETE /api/user/rpc-preferences/{chainId}
```

Reverts to default RPC endpoints for the chain.
