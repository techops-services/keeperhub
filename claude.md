# AI Workflow Builder Template (KeeperHub Fork)

## 🚨 CRITICAL: KeeperHub Custom Code Policy

**This is a fork of vercel-labs/workflow-builder-template. ALL custom changes MUST follow these rules:**

1. **ALL new features/changes go in `/keeperhub` directory**
   - Prevents merge conflicts when syncing from upstream
   - Mirror the project structure inside `/keeperhub` (e.g., `keeperhub/components/`, `keeperhub/plugins/`)

2. **When modifying core files outside `/keeperhub`, use markers:**

   ```typescript
   // start custom keeperhub code //
   ... your custom code here ...
   // end keeperhub code //
   ```

3. **Git remote structure:**
   - `upstream` → vercel-labs/workflow-builder-template (original template)
   - `origin` → techops-services/keeperhub (our fork)
   - Merge from: `upstream/main`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19, shadcn/ui, Radix UI, Tailwind CSS 4
- **Database**: PostgreSQL + Drizzle ORM
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **AI**: Vercel AI SDK with Anthropic/OpenAI
- **Workflow**: Workflow DevKit 4.0.1-beta.17
- **Package Manager**: pnpm

## Project Structure

```
app/              - Next.js app directory
components/       - UI components
lib/              - Core utilities
plugins/          - Core plugins
scripts/          - Build/migration scripts
tests/            - Test files

keeperhub/        - 🚨 ALL CUSTOM CODE GOES HERE
  ├── api/        - Custom API routes
  ├── app/        - Custom pages
  ├── components/ - Custom components
  ├── db/         - Custom schemas
  ├── lib/        - Custom utilities
  └── plugins/    - Custom plugins
```

## Common Commands

```bash
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm type-check             # TypeScript check
pnpm check / pnpm fix       # Lint

pnpm db:push                # Push schema changes
pnpm db:studio              # Open Drizzle Studio

pnpm discover-plugins       # Scan and register plugins
pnpm create-plugin          # Create new plugin

pnpm test                   # All tests
pnpm test:e2e               # E2E tests
```

## Branch Strategy

- **Main branch**: `staging`
- **Feature branches**: `feature/KEEP-XXXX-description`

---

## Plugin Development

**Context**: Building Web3 integrations for the workflow system. Plugins go in `keeperhub/plugins/`.

**Current Plugins**: `web3`, `webhook`, `discord`, `sendgrid`

**When creating new plugins**:

1. Check existing plugins: `ls keeperhub/plugins/`
2. Pick a recent, similar plugin as reference
3. Copy its exact structure and pattern
4. Keep it **absolutely minimal** - no extra features, no over-engineering

**Structure**: Each plugin has `index.ts` (definition), `icon.tsx`, `steps/` (actions), optional `credentials.ts` and `test.ts`.
