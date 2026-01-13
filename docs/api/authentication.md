---
title: "Authentication"
description: "KeeperHub API authentication methods - session auth and API keys."
---

# Authentication

The KeeperHub API supports two authentication methods.

## Session Authentication

For browser-based applications, authentication is handled via Better Auth session cookies. Users authenticate through the standard login flow at `app.keeperhub.com`.

## API Key Authentication

For programmatic access, use API keys in the `Authorization` header:

```bash
curl -H "Authorization: Bearer wfb_your_api_key" \
  https://app.keeperhub.com/api/workflows
```

### Creating API Keys

1. Navigate to Settings in the KeeperHub dashboard
2. Select "API Keys"
3. Click "Create New Key"
4. Copy the key immediately - it will only be shown once

### Key Format

API keys follow the format: `wfb_` followed by a random string.

### Key Security

- Keys are hashed with SHA256 before storage
- Only the key prefix is stored for identification
- Revoke keys immediately if compromised

## Webhook Authentication

For webhook triggers, use the workflow-specific webhook URL with your API key:

```bash
POST /api/workflows/{workflowId}/webhook
Authorization: Bearer wfb_your_api_key
```
