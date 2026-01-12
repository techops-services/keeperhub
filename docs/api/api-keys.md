---
title: "API Keys"
description: "KeeperHub API Keys - create and manage API keys for programmatic access."
---

# API Keys

Manage API keys for programmatic access to the KeeperHub API.

## List API Keys

```http
GET /api/api-keys
```

### Response

```json
{
  "data": [
    {
      "id": "key_123",
      "name": "Production Key",
      "keyPrefix": "wfb_abc",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

Note: The full key is never returned after creation.

## Create API Key

```http
POST /api/api-keys
```

### Request Body

```json
{
  "name": "My API Key"
}
```

### Response

```json
{
  "id": "key_123",
  "name": "My API Key",
  "key": "wfb_full_api_key_here",
  "keyPrefix": "wfb_ful",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

Important: Copy the `key` value immediately. It will only be shown once.

## Delete API Key

```http
DELETE /api/api-keys/{keyId}
```

Revokes the API key. This action cannot be undone.

### Response

```json
{
  "success": true
}
```

## Key Format

API keys follow the format:
- Prefix: `wfb_`
- Random string: 32 characters

Example: `wfb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Security Notes

- Keys are hashed with SHA256 before storage
- Only the key prefix is stored for identification
- Anonymous users cannot create API keys
- Revoke keys immediately if compromised
- Use environment variables to store keys in applications
