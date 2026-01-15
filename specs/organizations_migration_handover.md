# Database Migration Needed - ParaWallets Organization Column

## TL;DR - Quick Fix (Recommended)

**Just truncate the table and add the column**. The existing wallets are old test data anyway:

```sql
-- Truncate existing wallets (clean slate)
TRUNCATE TABLE para_wallets CASCADE;

-- Add organization_id column
ALTER TABLE para_wallets
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Drop old unique constraint
ALTER TABLE para_wallets
DROP CONSTRAINT IF EXISTS para_wallets_user_id_unique;

-- Add foreign key
ALTER TABLE para_wallets
ADD CONSTRAINT para_wallets_organization_id_organization_id_fk
FOREIGN KEY (organization_id)
REFERENCES organization(id)
ON DELETE CASCADE;

-- Add unique constraint
ALTER TABLE para_wallets
ADD CONSTRAINT para_wallets_organization_id_unique
UNIQUE (organization_id);
```

That's it! Users can recreate their organization wallets through the UI.

---

## Problem

The application code has been updated to scope `para_wallets` by `organization_id` instead of `user_id`, but the database column doesn't exist yet, causing errors:

```
Error [PostgresError]: column "organization_id" does not exist
at organizationHasWallet (keeperhub/lib/para/wallet-helpers.ts:98:18)
```

## What Changed (Code)

### Schema Updated

- **File**: `keeperhub/db/schema-extensions.ts`
- **Change**: Added `organizationId` field (nullable) to `paraWallets` table
- **Migration Generated**: `drizzle/0007_breezy_aqueduct.sql` (but not applied due to Drizzle prompt issue)

### API Updated

- **File**: `keeperhub/api/user/wallet/route.ts`
- **Changes**:
  - All wallet operations now scoped by `organizationId` from active session
  - Permission checks: Only org admins/owners can create/delete wallets
  - `POST /api/user/wallet` - Creates wallet for organization
  - `GET /api/user/wallet` - Gets wallet for active organization
  - `DELETE /api/user/wallet` - Deletes organization's wallet

### UI Updated

- **File**: `keeperhub/components/overlays/wallet-overlay.tsx`
- **Changes**:
  - Wallet creation form checks admin permissions
  - Shows "Create Organization Wallet" button for admins
  - Email input pre-filled with user's email
  - Non-admins see message that only admins can create wallets

## Migration Strategy

### Recommended: Truncate & Start Fresh

The few existing wallets in `para_wallets` are user-owned test wallets. Since we're changing to organization-owned wallets, **just delete them all** and let users recreate through the UI.

**Why this is safe:**

- These are test/development wallets
- Users can easily recreate wallets in the UI (click avatar → Wallet → Create)
- Avoids complex data migration logic
- Clean transition from user-owned to org-owned model

## After Migration (Future Step)

Once you're confident wallets are working, make `organization_id` NOT NULL:

```sql
ALTER TABLE para_wallets
ALTER COLUMN organization_id SET NOT NULL;
```

Then update `keeperhub/db/schema-extensions.ts`:

```typescript
organizationId: text("organization_id")
  .notNull() // Change from optional to notNull
  .unique()
  .references(() => organization.id, { onDelete: "cascade" }),
```

## Why Drizzle Didn't Work

We tried `pnpm db:push` but it gets stuck on an interactive prompt:

```
· You're about to add para_wallets_organization_id_unique unique constraint to
  the table, which contains 6 items. Do you want to truncate para_wallets table?

  ❯ No, add the constraint without truncating the table
    Yes, truncate the table
```

Even with `--force` flag, the prompt still appears in CLI. The prompt can't be bypassed programmatically, so we need to run the SQL directly.

## How to Run the Migration

### Option 1: Direct psql (Fastest)

```bash
# Get DATABASE_URL from .env
source .env
psql "$DATABASE_URL" <<EOF
TRUNCATE TABLE para_wallets CASCADE;
ALTER TABLE para_wallets ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE para_wallets DROP CONSTRAINT IF EXISTS para_wallets_user_id_unique;
ALTER TABLE para_wallets ADD CONSTRAINT para_wallets_organization_id_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE para_wallets ADD CONSTRAINT para_wallets_organization_id_unique UNIQUE (organization_id);
EOF
```

### Option 2: Node Script with Drizzle

```typescript
// scripts/migrate-org-column.ts
import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!);

async function migrate() {
  await sql`TRUNCATE TABLE para_wallets CASCADE`;
  await sql`ALTER TABLE para_wallets ADD COLUMN IF NOT EXISTS organization_id TEXT`;
  // ... rest of SQL
  await sql.end();
}

migrate();
```

Run: `tsx scripts/migrate-org-column.ts`

### Option 3: Drizzle Studio GUI

```bash
pnpm drizzle-kit studio
# Open http://localhost:4983
# Paste SQL into query console
```

### Option 4: Database GUI

- TablePlus, PgAdmin, DBeaver, etc.
- Connect using `DATABASE_URL` from `.env`
- Run the SQL

## Testing After Migration

1. **Verify schema**:

```sql
\d para_wallets
-- Should show organization_id column
```

2. **Test in UI**:
   - Sign in as org owner/admin
   - Click avatar → **Wallet**
   - Should see **"Create Organization Wallet"** button
   - Click it, enter email, create wallet
   - Verify wallet address shows up

3. **Test permissions**:
   - Sign in as regular member (non-admin)
   - Click avatar → **Wallet**
   - Should see message: "Only organization admins and owners can create wallets"

4. **Verify database**:

```sql
SELECT id, user_id, organization_id, wallet_address
FROM para_wallets;
-- Should show organization_id populated
```

## Environments

**This needs to be done in:**

- ✅ Local dev (your machine)
- ⏳ Staging
- ⏳ Production

Same SQL works for all environments.

## Files Changed (Already Committed)

- ✅ `keeperhub/db/schema-extensions.ts` - Schema definition
- ✅ `keeperhub/lib/para/wallet-helpers.ts` - Helper functions updated
- ✅ `keeperhub/api/user/wallet/route.ts` - API endpoints updated
- ✅ `keeperhub/components/overlays/wallet-overlay.tsx` - UI updated
- ✅ `keeperhub/components/settings/wallet-dialog.tsx` - Alternative UI updated
- ✅ `drizzle/0007_breezy_aqueduct.sql` - Migration file generated
- ✅ `docs/wallet-migration-todo.md` - Original migration strategy doc

## Contact

**Modified by**: Tait + Claude (2026-01-09)
**Branch**: `feature/KEEP-1141-organizations`
**Status**: Code complete, awaiting DB migration
**Blocked by**: Database column doesn't exist yet

---

## Summary for Non-Technical PM

We changed wallets from being owned by individual users to being owned by organizations (so teams can share wallets). The code is done but the database needs updating. Backend dev: run the SQL at the top of this doc and we're good to go. Users will need to recreate their wallets but it's a quick UI flow.
