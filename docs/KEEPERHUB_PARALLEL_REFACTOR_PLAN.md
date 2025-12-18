# KeeperHub Parallel Structure Refactor Plan

This document outlines the complete plan to refactor KeeperHub from editing the upstream Vercel Workflow Builder Template to a clean parallel structure that imports from the base without modifying original files.

## Current State Summary

**Git Remotes:**

- `upstream` - Vercel's original template (`vercel-labs/workflow-builder-template`)
- `origin` - TechOps fork (`techops-services/workflow-builder-template`)
- `fork` - KeeperHub repo (`techops-services/keeperhub`)

**Current Approach:** Directly editing upstream files, merging upstream changes with conflict resolution.

**Problem:** Every upstream update risks merge conflicts. KeeperHub features are interleaved with base template code.

---

## Complete Inventory of KeeperHub Customizations

### 1. Custom Plugins (NEW - Keep These)

These are entirely new plugins created for KeeperHub:

#### Web3 Plugin (`plugins/web3/`)

- **Actions:**
  - `check-balance` - Check ETH balance of any address
  - `transfer-funds` - Transfer ETH from Para wallet
  - `read-contract` - Read from smart contracts (view functions)
  - `write-contract` - Write to smart contracts (state-changing)
- **Files:**
  - `index.ts` - Plugin definition with ABI field types
  - `icon.tsx` - Web3 icon
  - `steps/check-balance.ts`
  - `steps/transfer-funds.ts`
  - `steps/read-contract.ts`
  - `steps/write-contract.ts`

#### SendGrid Plugin (`plugins/sendgrid/`)

- **Actions:**
  - `send-email` - Send transactional emails
- **Features:**
  - `requiresCredentials: false` - Uses KeeperHub API key by default
  - Optional user-provided API key
- **Files:**
  - `index.ts`
  - `icon.tsx`
  - `credentials.ts`
  - `test.ts`
  - `steps/send-email.ts`

#### Discord Plugin (`plugins/discord/`)

- **Actions:**
  - `send-message` - Send Discord messages via webhook
- **Files:**
  - `index.ts`
  - `icon.tsx`
  - `credentials.ts`
  - `test.ts`
  - `steps/send-message.ts`

#### Webhook Plugin (`plugins/webhook/`)

- **Actions:**
  - `send-webhook` - Send HTTP requests to webhook endpoints
- **Features:**
  - `requiresCredentials: false` - Configure URL/headers per action
- **Files:**
  - `index.ts`
  - `icon.tsx`
  - `credentials.ts`
  - `steps/send-webhook.ts`

### 2. Removed Upstream Plugins

These plugins exist in upstream but were removed for KeeperHub:

| Plugin        | Reason Removed                          |
| ------------- | --------------------------------------- |
| `ai-gateway/` | Replaced with direct OpenAI integration |
| `blob/`       | Not needed for KeeperHub use case       |
| `clerk/`      | Using Better Auth instead               |
| `fal/`        | AI image generation not needed          |
| `firecrawl/`  | Web scraping not needed                 |
| `github/`     | Not needed for initial release          |
| `linear/`     | Not needed for initial release          |
| `perplexity/` | AI search not needed                    |
| `stripe/`     | Not needed for initial release          |
| `superagent/` | Not needed for initial release          |

### 3. Database Schema Changes (`lib/db/schema.ts`)

**Added Tables:**

```typescript
// Para Wallets table - stores user wallet information
export const paraWallets = pgTable("para_wallets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  walletId: text("wallet_id").notNull(), // Para wallet ID
  walletAddress: text("wallet_address").notNull(), // EVM address (0x...)
  userShare: text("user_share").notNull(), // Encrypted keyshare
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Modified Tables:**

- Removed `isManaged` column from `integrations` table

### 4. New API Routes (`app/api/`)

| Route                             | Purpose                            |
| --------------------------------- | ---------------------------------- |
| `app/api/user/wallet/route.ts`    | Para wallet CRUD (GET/POST/DELETE) |
| `app/api/web3/fetch-abi/route.ts` | Fetch contract ABI from Etherscan  |

**Removed Routes:**

- `app/api/ai-gateway/consent/route.ts`
- `app/api/ai-gateway/status/route.ts`
- `app/api/ai-gateway/teams/route.ts`
- `app/api/integrations/test/route.ts` (consolidated)

### 5. New UI Components (`components/`)

| Component                                                  | Purpose                       |
| ---------------------------------------------------------- | ----------------------------- |
| `components/icons/keeperhub-logo.tsx`                      | KeeperHub branding logo       |
| `components/settings/wallet-dialog.tsx`                    | Para wallet management dialog |
| `components/settings/web3-wallet-section.tsx`              | Wallet section in settings    |
| `components/settings/sendgrid-integration-section.tsx`     | SendGrid special handling     |
| `components/workflow/config/abi-with-auto-fetch-field.tsx` | ABI auto-fetch from Etherscan |

### 6. Modified UI Components

| Component                                               | Changes                          |
| ------------------------------------------------------- | -------------------------------- |
| `components/settings/integration-form-dialog.tsx`       | Simplified, removed OAuth flows  |
| `components/settings/integrations-manager.tsx`          | Added wallet section, simplified |
| `components/settings/integrations-dialog.tsx`           | UI improvements                  |
| `components/settings/index.tsx`                         | Added wallet tab                 |
| `components/workflow/config/action-config-renderer.tsx` | Added ABI field types            |
| `components/workflow/config/action-config.tsx`          | Integration selector changes     |
| `components/workflow/config/action-grid.tsx`            | Simplified action grid           |
| `components/ui/integration-selector.tsx`                | Simplified selector              |
| `components/workflow/node-config-panel.tsx`             | Layout improvements              |
| `components/workflow/workflow-toolbar.tsx`              | KeeperHub branding               |

### 7. Branding Changes

| File                                  | Change                                              |
| ------------------------------------- | --------------------------------------------------- |
| `app/favicon.ico`                     | KeeperHub favicon                                   |
| `app/layout.tsx`                      | Title: "KeeperHub - Blockchain Workflow Automation" |
| `app/globals.css`                     | Custom styles, green accent color                   |
| `components/icons/keeperhub-logo.tsx` | Green K logo                                        |

### 8. Infrastructure / DevOps

**New Files:**

- `.github/workflows/deploy.yaml` - CI/CD pipeline
- `.github/workflows/upstream-sync.yml` - Auto-sync with upstream
- `Dockerfile` - Container build
- `docker-compose.yml` - Local development
- `docker-compose-dot-ai.yaml` - AI services compose
- `Makefile` - Build/deploy commands
- `deploy/local/` - Minikube deployment scripts
- `deploy/staging/values.yaml` - Kubernetes values for staging
- `.dockerignore` - Docker ignore rules
- `instrumentation.ts` - OpenTelemetry instrumentation

### 9. Library Additions

| File                         | Purpose                           |
| ---------------------------- | --------------------------------- |
| `lib/api-error.ts`           | Centralized API error handling    |
| `lib/logger.ts`              | Structured logging with LOG_LEVEL |
| `lib/encryption.ts`          | Wallet/credential encryption      |
| `lib/para/wallet-helpers.ts` | Para wallet integration helpers   |

### 10. Environment Variables (Staging)

```yaml
# KeeperHub-specific environment variables
PARA_ENVIRONMENT: "beta"
PARA_API_KEY: (from secrets)
WALLET_ENCRYPTION_KEY: (from secrets)
ETHERSCAN_API_KEY: (from secrets)
SENDGRID_API_KEY: (from secrets)
FROM_ADDRESS: "noreply@keeperhub.com"
AI_MODEL: "gpt-4o"
LOG_LEVEL: "info"
```

### 11. Beta Allowlist

`config/beta-allowlist.json` contains 170+ email addresses for beta access.

---

## Refactor Plan: - Parallel Structure

### Target Directory Structure

```
techops-workflow-builder-template/
├── app/                          # Keep as-is (upstream)
├── components/                   # Keep as-is (upstream)
├── lib/                          # Keep as-is (upstream)
├── plugins/                      # Keep as-is (upstream)
│
├── keeperhub/                    # NEW: Parallel KeeperHub app
│   ├── app/                      # KeeperHub-specific routes
│   │   ├── layout.tsx            # Custom layout with branding
│   │   ├── page.tsx              # Custom landing (if different)
│   │   └── (routes)/             # Additional KeeperHub routes
│   │
│   ├── components/               # KeeperHub-specific components
│   │   ├── icons/
│   │   │   └── keeperhub-logo.tsx
│   │   ├── settings/
│   │   │   ├── wallet-dialog.tsx
│   │   │   ├── web3-wallet-section.tsx
│   │   │   └── sendgrid-integration-section.tsx
│   │   └── workflow/
│   │       └── config/
│   │           └── abi-with-auto-fetch-field.tsx
│   │
│   ├── lib/                      # KeeperHub-specific lib
│   │   ├── api-error.ts
│   │   ├── logger.ts
│   │   ├── encryption.ts
│   │   └── para/
│   │       └── wallet-helpers.ts
│   │
│   ├── plugins/                  # KeeperHub-specific plugins
│   │   ├── index.ts              # Plugin registry (imports base + custom)
│   │   ├── web3/                 # MOVE from plugins/web3
│   │   ├── sendgrid/             # MOVE from plugins/sendgrid
│   │   ├── discord/              # MOVE from plugins/discord
│   │   └── webhook/              # MOVE from plugins/webhook
│   │
│   ├── api/                      # KeeperHub API extensions
│   │   ├── user/
│   │   │   └── wallet/
│   │   │       └── route.ts
│   │   └── web3/
│   │       └── fetch-abi/
│   │           └── route.ts
│   │
│   ├── db/                       # KeeperHub schema extensions
│   │   └── schema-extensions.ts  # paraWallets table
│   │
│   └── config/                   # KeeperHub config
│       └── beta-allowlist.json
│
├── deploy/                       # KEEP: Deployment configs
│   ├── local/
│   └── staging/
│
└── .github/                      # KEEP: CI/CD workflows
    └── workflows/
```

### Step-by-Step Migration Tasks

#### Phase 1: Setup Parallel Structure (Day 1)

- [x] Create `keeperhub/` directory structure
- [x] Create `keeperhub/plugins/index.ts` that imports base plugins + custom
- [x] Move `plugins/web3/` to `keeperhub/plugins/web3/`
- [x] Move `plugins/sendgrid/` to `keeperhub/plugins/sendgrid/`
- [x] Move `plugins/discord/` to `keeperhub/plugins/discord/`
- [x] Move `plugins/webhook/` to `keeperhub/plugins/webhook/`
- [x] Update import paths in moved plugins
- [x] Update `scripts/discover-plugins.ts` to scan both `plugins/` and `keeperhub/plugins/`

#### Phase 2: Move KeeperHub Components (Day 1-2)

- [x] Move `components/icons/keeperhub-logo.tsx` to `keeperhub/components/icons/`
- [x] Move `components/settings/wallet-dialog.tsx` to `keeperhub/components/settings/`
- [x] Move `components/settings/web3-wallet-section.tsx` to `keeperhub/components/settings/`
- [x] Move `components/workflow/config/abi-with-auto-fetch-field.tsx` to `keeperhub/components/workflow/config/`
- [x] Update imports in base components to use `@/keeperhub/` paths

#### Phase 3: Move KeeperHub Libraries and API Routes (Day 2)

- [x] Move `lib/encryption.ts` to `keeperhub/lib/`
- [x] Move `lib/para/wallet-helpers.ts` to `keeperhub/lib/para/`
- [x] Move `lib/api-error.ts` to `keeperhub/lib/` (KeeperHub-only utility)
- [x] Move `app/api/user/wallet/route.ts` to `keeperhub/api/user/wallet/route.ts`
- [x] Move `app/api/web3/fetch-abi/route.ts` to `keeperhub/api/web3/fetch-abi/route.ts`
- [x] Create thin wrapper routes in `app/api/` that re-export from `keeperhub/api/`
- [x] Revert base API routes to upstream-style inline error handling (remove apiError dependency)
- [x] Create `keeperhub/db/schema-extensions.ts` with paraWallets table

**Note on `lib/api-error.ts`:** This utility was added by KeeperHub and modified 20 base API routes. To maintain upstream compatibility, we reverted all base routes to use inline error handling (matching upstream pattern) and moved `api-error.ts` to `keeperhub/lib/` for use only in KeeperHub-specific routes.

#### Phase 4: Create Extension Points (Day 3)

Create wrapper components that extend base with KeeperHub features:

```typescript
// keeperhub/components/settings/k-integrations-manager.tsx
import { IntegrationsManager } from "@/components/settings/integrations-manager";
import { Web3WalletSection } from "./web3-wallet-section";

export function KeeperHubIntegrationsManager() {
  return (
    <IntegrationsManager>
      <Web3WalletSection />
    </IntegrationsManager>
  );
}
```

#### Phase 5: Revert Base Files to Upstream (Day 3-4)

- [ ] Revert `app/layout.tsx` to upstream version
- [ ] Revert `app/globals.css` to upstream version
- [ ] Revert `components/settings/integration-form-dialog.tsx` to upstream
- [ ] Revert `components/settings/integrations-manager.tsx` to upstream
- [ ] Revert `components/workflow/config/action-config-renderer.tsx` to upstream
- [ ] Revert `lib/db/schema.ts` to upstream (paraWallets in extension)
- [ ] Revert `plugins/index.ts` to upstream

#### Phase 6: Configure Build (Day 4)

- [ ] Update `next.config.ts` for KeeperHub routes
- [ ] Create `keeperhub/next.config.ts` overrides
- [ ] Update `package.json` scripts for KeeperHub mode
- [ ] Configure environment variable `KEEPERHUB_MODE=true`

#### Phase 7: Testing (Day 5)

- [ ] Test base template works standalone
- [ ] Test KeeperHub features work with extensions
- [ ] Test upstream merge doesn't break KeeperHub
- [ ] Test deployment pipeline

---

## Configuration Strategy

### Next.js Configuration

```typescript
// next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      // KeeperHub API routes
      {
        source: "/api/user/wallet/:path*",
        destination: "/keeperhub/api/user/wallet/:path*",
      },
      {
        source: "/api/web3/:path*",
        destination: "/keeperhub/api/web3/:path*",
      },
    ];
  },
};
```

### Plugin Registry

```typescript
// keeperhub/plugins/index.ts
// Import base plugins (from upstream)
import "@/plugins/resend";
import "@/plugins/slack";

// Import KeeperHub custom plugins
import "./web3";
import "./sendgrid";
import "./discord";
import "./webhook";

// Re-export registry utilities
export * from "@/plugins/registry";
```

### Environment-Based Configuration

```typescript
// keeperhub/lib/config.ts
export const isKeeperHubMode = process.env.KEEPERHUB_MODE === "true";

export const config = {
  appName: isKeeperHubMode ? "KeeperHub" : "Workflow Builder",
  logoComponent: isKeeperHubMode ? KeeperHubLogo : DefaultLogo,
  enableWeb3: isKeeperHubMode,
  enableParaWallet: isKeeperHubMode,
};
```

---

## Benefits of Parallel Structure

1. **Clean Upstream Syncs** - No merge conflicts on base files
2. **Clear Separation** - KeeperHub code is isolated in `keeperhub/`
3. **Easy Testing** - Can run vanilla template vs KeeperHub
4. **Maintainability** - New team members understand the boundary
5. **Selective Features** - Can enable/disable KeeperHub mode
6. **Version Control** - Easy to see what's custom vs base

---

## Risk Mitigation

| Risk                                | Mitigation                       |
| ----------------------------------- | -------------------------------- |
| Import path changes break things    | Use path aliases (`@keeperhub/`) |
| Upstream changes base component API | Create stable adapter layer      |
| Migration breaks production         | Feature flag for gradual rollout |
| Performance overhead                | Lazy load KeeperHub components   |

---

## Timeline Estimate

| Phase                     | Duration      | Effort |
| ------------------------- | ------------- | ------ |
| Phase 1: Setup            | 0.5 day       | Low    |
| Phase 2: Move Components  | 1 day         | Medium |
| Phase 3: Move Libraries   | 0.5 day       | Low    |
| Phase 4: Move API Routes  | 1 day         | Medium |
| Phase 5: Extension Points | 1 day         | High   |
| Phase 6: Revert Base      | 1 day         | Medium |
| Phase 7: Configure Build  | 0.5 day       | Medium |
| Phase 8: Testing          | 1 day         | High   |
| **Total**                 | **~6.5 days** |        |

---

## Post-Migration Maintenance

### Upstream Sync Process

1. `git fetch upstream`
2. `git merge upstream/main` - Should have NO conflicts on base files
3. Test base functionality
4. Test KeeperHub extensions
5. Deploy

### Adding New KeeperHub Features

1. Create new files in `keeperhub/` directory
2. Import/extend base components as needed
3. Add routes under `keeperhub/api/`
4. Never modify files outside `keeperhub/` unless necessary

### When Base Modification is Necessary

If you must modify a base file:

1. Document WHY in this file
2. Create a GitHub issue to track
3. Consider if it should be an upstream PR instead
4. Minimize changes - prefer composition over modification
