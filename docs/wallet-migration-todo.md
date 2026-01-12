# ParaWallet Organization Migration TODO

## Current State

The `para_wallets` table schema has been updated to support organization ownership:

```sql
CREATE TABLE para_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT REFERENCES organization(id), -- NULLABLE for now
  email TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  user_share TEXT NOT NULL (encrypted),
  created_at TIMESTAMP NOT NULL,
  UNIQUE(organization_id) -- One wallet per organization
);
```

## Problem

There are **6 existing wallet records** with `organization_id = NULL`. These are old user-owned wallets that need to be migrated to organization ownership.

## Migration Strategy

### Option 1: Assign to Personal Organizations (Recommended)

For each existing wallet:
1. Find the user's personal organization (created during signup)
2. Set `wallet.organization_id` to that org's ID
3. Update the associated `integrations` record to set `organization_id`

```sql
-- Example migration script
UPDATE para_wallets pw
SET organization_id = (
  SELECT o.id
  FROM organization o
  JOIN member m ON m.organization_id = o.id
  WHERE m.user_id = pw.user_id
    AND m.role = 'owner'
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Also update integrations
UPDATE integrations i
SET organization_id = (
  SELECT pw.organization_id
  FROM para_wallets pw
  WHERE i.user_id = pw.user_id
    AND i.type = 'web3'
)
WHERE type = 'web3'
  AND organization_id IS NULL;
```

### Option 2: Delete Old Wallets

If the 6 existing wallets are test data:
```sql
DELETE FROM para_wallets WHERE organization_id IS NULL;
DELETE FROM integrations WHERE type = 'web3' AND organization_id IS NULL;
```

## After Migration

Once all wallets have an `organization_id`:

1. Make the column NOT NULL:
```sql
ALTER TABLE para_wallets
ALTER COLUMN organization_id SET NOT NULL;
```

2. Update schema file: `keeperhub/db/schema-extensions.ts`
```typescript
organizationId: text("organization_id")
  .notNull() // Change from nullable to notNull()
  .unique()
  .references(() => organization.id, { onDelete: "cascade" }),
```

3. Generate and apply final migration:
```bash
pnpm drizzle-kit generate
pnpm db:push
```

## Testing

After migration:
- ✅ Verify all existing wallets have `organization_id` set
- ✅ Verify wallet addresses are still accessible
- ✅ Test creating new organization wallets
- ✅ Test deleting organization wallets (should cascade)
- ✅ Test organization member access (only admins/owners can manage)

## Files Modified

- `keeperhub/db/schema-extensions.ts` - Schema definition
- `keeperhub/lib/para/wallet-helpers.ts` - Helper functions
- `keeperhub/api/user/wallet/route.ts` - API endpoints
- `keeperhub/components/overlays/wallet-overlay.tsx` - UI component

## Contact

Questions? Ask the dev who implemented organization wallet scoping (Tait + Claude 2026-01-09)
