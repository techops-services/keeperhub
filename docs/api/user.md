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

## Change Password

```http
POST /api/user/password
```

Change the password for a credential-based account. Requires the current password and a new password (minimum 8 characters). Not available for OAuth-only accounts.

### Request Body

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

## Forgot Password

```http
POST /api/user/forgot-password
```

Handles password reset via OTP. Supports two actions controlled by the `action` field in the request body.

**Request OTP** (default when `action` is omitted or set to `"request"`):

```json
{
  "email": "user@example.com"
}
```

**Reset password** (`action: "reset"`):

```json
{
  "action": "reset",
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-password"
}
```

The OTP expires after 5 minutes. OAuth-only accounts receive a notification email instead of a reset code.

## Deactivate Account

```http
POST /api/user/delete
```

Soft-deletes the authenticated user account. Requires a confirmation string in the request body. Invalidates all active sessions on success. Not available for anonymous users.

### Request Body

```json
{
  "confirmation": "DEACTIVATE"
}
```

## Address Book

Manage saved Ethereum addresses scoped to the active organization. All address book endpoints require an active organization context.

### List Address Book Entries

```http
GET /api/address-book
```

Returns all address book entries for the active organization, ordered by creation date (newest first).

### Create Address Book Entry

```http
POST /api/address-book
```

#### Request Body

```json
{
  "label": "Treasury Wallet",
  "address": "0x..."
}
```

The address must be a valid Ethereum address.

### Update Address Book Entry

```http
PATCH /api/address-book/{entryId}
```

Update the label or address of an existing entry. Both fields are optional.

### Delete Address Book Entry

```http
DELETE /api/address-book/{entryId}
```

Removes the entry from the organization address book.
