# User RPC Configuration API

This document describes the API endpoints for managing user-defined RPC configurations in KeeperHub. Users can override the default RPC endpoints for supported blockchain networks with their own custom RPC URLs (e.g., from Infura, Alchemy, or private nodes).

## Overview

KeeperHub supports a two-tier RPC configuration system:

1. **Default RPC endpoints** - System-wide defaults seeded from `scripts/seed-chains.ts`
2. **User RPC preferences** - Per-user overrides that take precedence over defaults

When a user sets a custom RPC preference for a chain, all web3 operations for that user on that chain will use their custom RPC URLs instead of the defaults.

## Database Schema

### Chains Table

Stores supported blockchain networks with default RPC endpoints.

```typescript
// lib/db/schema.ts
{
  id: string;           // UUID
  chainId: number;      // e.g., 1 (Ethereum), 11155111 (Sepolia)
  name: string;         // e.g., "Ethereum Mainnet"
  symbol: string;       // e.g., "ETH"
  defaultPrimaryRpc: string;    // Primary RPC URL
  defaultFallbackRpc?: string;  // Fallback RPC URL (optional)
  explorerUrl?: string;         // e.g., "https://etherscan.io"
  explorerApiUrl?: string;      // For ABI fetching
  isTestnet: boolean;
  isEnabled: boolean;
}
```

### User RPC Preferences Table

Stores user-specific RPC overrides.

```typescript
// lib/db/schema.ts
{
  id: string;           // UUID
  userId: string;       // References users.id
  chainId: number;      // References chains.chainId
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### 1. List Available Chains

**GET** `/api/chains`

Returns all supported blockchain networks.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeDisabled` | `"true"` | `"false"` | Include disabled chains in response |

#### Response

```typescript
type GetChainsResponse = Array<{
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  defaultPrimaryRpc: string;
  defaultFallbackRpc: string | null;
  explorerUrl: string | null;
  explorerApiUrl: string | null;
  isTestnet: boolean;
  isEnabled: boolean;
}>;
```

#### Example

```typescript
// Fetch enabled chains
const response = await fetch('/api/chains');
const chains = await response.json();

// Example response:
[
  {
    "id": "abc123",
    "chainId": 1,
    "name": "Ethereum Mainnet",
    "symbol": "ETH",
    "defaultPrimaryRpc": "https://chain.techops.services/eth-mainnet",
    "defaultFallbackRpc": "https://eth.llamarpc.com",
    "explorerUrl": "https://etherscan.io",
    "explorerApiUrl": "https://api.etherscan.io/v2/api",
    "isTestnet": false,
    "isEnabled": true
  },
  {
    "id": "def456",
    "chainId": 11155111,
    "name": "Sepolia Testnet",
    "symbol": "ETH",
    "defaultPrimaryRpc": "https://chain.techops.services/eth-sepolia",
    "defaultFallbackRpc": "https://rpc.sepolia.org",
    "explorerUrl": "https://sepolia.etherscan.io",
    "explorerApiUrl": "https://api-sepolia.etherscan.io/v2/api",
    "isTestnet": true,
    "isEnabled": true
  }
]
```

---

### 2. Set User RPC Preference

**PUT** `/api/user/rpc-preferences/:chainId`

Set or update a user's custom RPC endpoint for a specific chain. Requires authentication.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `chainId` | `number` | The chain ID (e.g., 1, 11155111) |

#### Request Body

```typescript
type SetRpcPreferenceRequest = {
  primaryRpcUrl: string;      // Required - main RPC endpoint
  fallbackRpcUrl?: string;    // Optional - backup RPC endpoint
};
```

#### Response

```typescript
type SetRpcPreferenceResponse = {
  id: string;
  chainId: number;
  primaryRpcUrl: string;
  fallbackRpcUrl: string | null;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
};
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Invalid chain ID"` | chainId is not a valid number |
| 400 | `"primaryRpcUrl is required"` | Missing required field |
| 400 | `"Invalid RPC URL format"` | URL validation failed |
| 401 | `"Unauthorized"` | User not authenticated |
| 404 | `"Chain {chainId} not found"` | Chain doesn't exist in database |

#### Example

```typescript
// Set custom RPC for Ethereum Mainnet
const response = await fetch('/api/user/rpc-preferences/1', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    primaryRpcUrl: 'https://mainnet.infura.io/v3/YOUR_API_KEY',
    fallbackRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY'
  })
});

const preference = await response.json();

// Example response:
{
  "id": "pref123",
  "chainId": 1,
  "primaryRpcUrl": "https://mainnet.infura.io/v3/YOUR_API_KEY",
  "fallbackRpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
  "createdAt": "2026-01-07T00:00:00.000Z",
  "updatedAt": "2026-01-07T00:00:00.000Z"
}
```

---

### 3. Delete User RPC Preference

**DELETE** `/api/user/rpc-preferences/:chainId`

Remove a user's custom RPC preference, reverting to system defaults. Requires authentication.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `chainId` | `number` | The chain ID (e.g., 1, 11155111) |

#### Response

```typescript
type DeleteRpcPreferenceResponse = {
  success: true;
};
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Invalid chain ID"` | chainId is not a valid number |
| 401 | `"Unauthorized"` | User not authenticated |
| 404 | `"RPC preference not found"` | No custom preference exists for this chain |

#### Example

```typescript
// Remove custom RPC for Ethereum, revert to defaults
const response = await fetch('/api/user/rpc-preferences/1', {
  method: 'DELETE'
});

const result = await response.json();
// { "success": true }
```

---

## Frontend Implementation Guide

### 1. RPC Settings Component

Create a settings page where users can manage their RPC configurations:

```tsx
// Example: components/settings/rpc-settings.tsx
import { useState, useEffect } from 'react';

type Chain = {
  chainId: number;
  name: string;
  symbol: string;
  defaultPrimaryRpc: string;
  defaultFallbackRpc: string | null;
};

type UserPreference = {
  chainId: number;
  primaryRpcUrl: string;
  fallbackRpcUrl: string | null;
};

export function RpcSettings() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [preferences, setPreferences] = useState<Map<number, UserPreference>>(new Map());

  useEffect(() => {
    // Fetch available chains
    fetch('/api/chains')
      .then(res => res.json())
      .then(setChains);
  }, []);

  const savePreference = async (chainId: number, primary: string, fallback?: string) => {
    const res = await fetch(`/api/user/rpc-preferences/${chainId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryRpcUrl: primary,
        fallbackRpcUrl: fallback
      })
    });

    if (res.ok) {
      const pref = await res.json();
      setPreferences(prev => new Map(prev).set(chainId, pref));
    }
  };

  const resetToDefault = async (chainId: number) => {
    const res = await fetch(`/api/user/rpc-preferences/${chainId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      setPreferences(prev => {
        const next = new Map(prev);
        next.delete(chainId);
        return next;
      });
    }
  };

  return (
    <div>
      <h2>RPC Configuration</h2>
      {chains.map(chain => (
        <ChainRpcForm
          key={chain.chainId}
          chain={chain}
          preference={preferences.get(chain.chainId)}
          onSave={(primary, fallback) => savePreference(chain.chainId, primary, fallback)}
          onReset={() => resetToDefault(chain.chainId)}
        />
      ))}
    </div>
  );
}
```

### 2. Form Validation

Validate RPC URLs before submission:

```typescript
function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// Optional: Test RPC connectivity
async function testRpcConnection(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1
      })
    });
    const data = await response.json();
    return data.result !== undefined;
  } catch {
    return false;
  }
}
```

### 3. Display Current Configuration

Show users what RPC they're currently using:

```tsx
function CurrentRpcDisplay({ chain, preference }: {
  chain: Chain;
  preference?: UserPreference;
}) {
  const isCustom = !!preference;
  const primaryRpc = preference?.primaryRpcUrl ?? chain.defaultPrimaryRpc;
  const fallbackRpc = preference?.fallbackRpcUrl ?? chain.defaultFallbackRpc;

  return (
    <div>
      <h3>{chain.name}</h3>
      <div>
        <span className={isCustom ? 'text-blue-500' : 'text-gray-500'}>
          {isCustom ? 'Custom' : 'Default'}
        </span>
      </div>
      <div>
        <label>Primary RPC:</label>
        <code>{maskApiKey(primaryRpc)}</code>
      </div>
      {fallbackRpc && (
        <div>
          <label>Fallback RPC:</label>
          <code>{maskApiKey(fallbackRpc)}</code>
        </div>
      )}
    </div>
  );
}

// Mask API keys in URLs for display
function maskApiKey(url: string): string {
  return url.replace(/([?&]key=|\/v\d\/)[^&/]+/gi, '$1***');
}
```

## Supported Chains (Default)

| Chain | Chain ID | Primary RPC | Fallback RPC |
|-------|----------|-------------|--------------|
| Ethereum Mainnet | 1 | `chain.techops.services/eth-mainnet` | `eth.llamarpc.com` |
| Sepolia Testnet | 11155111 | `chain.techops.services/eth-sepolia` | `rpc.sepolia.org` |
| Base | 8453 | `chain.techops.services/base-mainnet` | `mainnet.base.org` |

## Security Considerations

1. **HTTPS Required**: All RPC URLs should use HTTPS in production
2. **API Key Protection**: User RPC URLs may contain API keys - never log full URLs
3. **Rate Limiting**: Consider adding rate limits to prevent abuse
4. **Validation**: Always validate URLs server-side before saving

## Related Files

- `app/api/chains/route.ts` - Chains list endpoint
- `app/api/user/rpc-preferences/[chainId]/route.ts` - User preferences endpoints
- `lib/rpc/chain-service.ts` - Chain CRUD operations
- `lib/rpc/config-service.ts` - RPC config resolution logic
- `lib/rpc/provider-factory.ts` - Creates RPC providers with failover
- `lib/db/schema.ts` - Database schema definitions
- `scripts/seed-chains.ts` - Default chain seeding script
