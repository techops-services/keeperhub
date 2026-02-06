# AI Workflow Builder Template (KeeperHub Fork)

## AI Agents Code Policy

- **No Emojis**: Do not use emojis in any code, documentation, or README files
- **No File Structure**: Do not include file/folder structure diagrams in README files
- **No Random Documentation**: Do not create markdown documentation files unless explicitly requested by the user. This includes integration guides, feature documentation, or any other .md files
- **No co-authored with Claude in PR descriptions and git commits**
- **Do not git push or create Github PRs without user's confirmation**
- **Do not leave code comments with summaries of user's prompt**

## Code Quality: Lint and Type Checking

**Before writing or editing any code**, review the lint configuration to write compliant code:

1. **Check `biome.jsonc`** for project-specific lint rules and exclusions
2. **Check `.cursor/rules/ultracite.mdc`** for detailed coding standards

### Key Ultracite/Biome Rules

- Use explicit types for function parameters and return values
- Prefer `unknown` over `any`
- Use `for...of` loops over `.forEach()` and indexed loops
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Use `const` by default, `let` only when reassignment is needed
- Always `await` promises in async functions
- Remove `console.log`, `debugger`, and `alert` from production code
- Use Next.js `<Image>` component instead of `<img>` tags
- Add `rel="noopener"` when using `target="_blank"`

### Before Every Commit

Run these checks and fix any issues before committing:

```bash
pnpm check      # Lint check (Ultracite/Biome)
pnpm type-check # TypeScript validation
pnpm fix        # Auto-fix lint issues (run if check fails)
```

If `pnpm check` or `pnpm type-check` fails, fix the issues before committing. Do not commit code with lint or type errors.

### Lint Output Caching

When lint/type-check commands run, their output is saved to gitignored files:

- `.claude/lint-output.txt` - Output from `pnpm check`
- `.claude/typecheck-output.txt` - Output from `pnpm type-check`

**Workflow for fixing errors:**
1. Run `pnpm check` or `pnpm type-check` once
2. Read `.claude/lint-output.txt` or `.claude/typecheck-output.txt` for errors
3. Fix the errors in code
4. Re-run the check command only when you need fresh output

**Do NOT** repeatedly run lint commands to check progress. Read the cached output file instead - this saves time and context.

### Claude Hooks (Automatic Checks)

This project has Claude Code hooks configured in `.claude/settings.json`:

**Pre-Edit Lint Context** (`.claude/hooks/pre-edit-lint-context.sh`):
- Fires before Edit/Write on .ts/.tsx/.js/.jsx files
- Injects key Ultracite/Biome lint rules into context
- **Rationale**: Higher upfront token cost, but saves overall context by writing correct code the first time instead of the expensive cycle of: write code → run lint → see errors → fix partially → re-run lint → repeat

**Pre-Commit Checks** (`.claude/hooks/pre-commit-checks.sh`):
- Detects `git commit` commands
- Runs `pnpm check` (lint) and `pnpm type-check` (TypeScript)
- Saves output to `.claude/*.txt` files for reading without re-running
- Blocks the commit (exit code 2) if either fails

### Lint Ignore Comments

**Only use lint ignore comments when absolutely necessary.** Valid reasons:

- Third-party library types are incorrect and cannot be fixed
- Generated code that cannot be modified
- Rare edge cases where the rule genuinely does not apply

**Invalid reasons** (fix the code instead):

- "It works fine"
- "The rule is too strict"
- "It's faster to ignore than fix"

When you must use an ignore comment:
1. Use the most specific ignore possible (target the exact rule, not all rules)
2. Add a brief comment explaining why the ignore is necessary
3. Example:
   ```typescript
   // biome-ignore lint/suspicious/noExplicitAny: third-party SDK types are incomplete
   const result = externalLib.call() as any;
   ```

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

---

## MCP Schemas Endpoint

**Files**:
- `keeperhub/api/mcp/schemas/route.ts` - Implementation
- `app/api/mcp/schemas/route.ts` - Thin wrapper (re-exports from keeperhub)

This endpoint serves workflow schemas to the KeeperHub MCP server. It's the source of truth for what actions, triggers, and capabilities are available.

### What's Dynamic (no maintenance needed)

- **Plugin Actions**: Pulled from `getAllIntegrations()` registry - add plugins normally and they appear automatically
- **Chains**: Pulled from database `chains` table - add chains via DB and they appear automatically
- **Platform Capabilities**: Derived by scanning plugin field types (e.g., `abi-with-auto-fetch` → proxy support)

### What's Inline (update when changed)

These are defined directly in the file because they rarely change and aren't in a registry:

| Section | When to Update |
|---------|----------------|
| `SYSTEM_ACTIONS` | Adding new system action (Condition, HTTP Request, Database Query) |
| `TRIGGERS` | Adding new trigger type (Manual, Schedule, Webhook, Event) |
| `TEMPLATE_SYNTAX` | If template syntax `{{@nodeId:Label.field}}` changes |
| `tips` array | When adding guidance for AI workflow generation |

### How to Update

1. **New System Action**: Add entry to `SYSTEM_ACTIONS` object, implement step in `lib/steps/`
2. **New Trigger**: Add entry to `TRIGGERS` object, implement UI in `components/workflow/config/trigger-config.tsx`
3. **New Plugin**: Just create the plugin normally in `keeperhub/plugins/` - it's picked up automatically

### Testing the Endpoint

```bash
# Get all schemas
curl http://localhost:3000/api/mcp/schemas

# Filter by category
curl http://localhost:3000/api/mcp/schemas?category=web3

# Without chains
curl http://localhost:3000/api/mcp/schemas?includeChains=false
```
