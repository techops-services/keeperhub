# KeeperHub

## What This Is

A Web3 workflow automation platform (forked from vercel-labs/workflow-builder-template) that enables users to create, manage, and execute blockchain automation workflows. Supports smart contract monitoring, token transfers, DeFi operations, and integrations with Discord, SendGrid, and webhooks.

## Core Value

Users can build and deploy Web3 automation workflows through a visual builder without writing code.

## Requirements

### Validated

- ✓ sc-event-tracker monitors blockchain events and triggers workflows -- v1.0
- ✓ sc-event-worker provides HTTP interface for event tracker and forwards executions -- v1.0
- ✓ Scheduler dispatcher queries schedules and dispatches to SQS -- v1.0
- ✓ Scheduler executor polls SQS and triggers workflow executions -- v1.0
- ✓ Main app API endpoints for workflow execution -- v1.0
- ✓ Events services deployed independently from keeperhub-events repo -- v1.0
- ✓ Scheduler services deployed independently from keeperhub-scheduler repo -- v1.0
- ✓ Internal HTTP APIs for scheduler operations (6 endpoints) -- v1.0
- ✓ X-Service-Key authentication for internal APIs -- v1.0
- ✓ OG image routes resolve all dependencies in production K8s build -- v1.1
- ✓ Default, hub, and workflow OG images render valid PNGs in production -- v1.1
- ✓ Font files accessible at runtime in production -- v1.1

### Active

- [ ] Hub UI: Protocols tab with protocol grid and detail views

### Validated (v1.2)

- defineProtocol() system for declarative protocol definitions -- Phase 6
- Protocol definitions auto-generate workflow nodes via existing plugin system -- Phase 7
- ABI auto-resolution from block explorers with caching -- Phase 8
- Multi-chain contract address management per protocol -- Phase 8 (WETH: 4 chains)
- Protocol actions appear in workflow builder and MCP schemas -- Phase 7
- Core logic extraction (read-contract-core, write-contract-core) -- Phase 6

### Out of Scope

- Shared npm package for schema -- HTTP APIs eliminate need
- Offline mode -- real-time blockchain monitoring is core
- Mobile app -- web-first approach
- Database storage for protocol definitions -- file-based for MVP
- Custom protocol icons -- generic icon, add later per-protocol
- Token metadata auto-detection -- manual decimals for now
- Protocol version management (v2/v3 of same protocol) -- add when needed
- Hub sidebar chain filter -- search only for MVP
- Action pre-insertion into workflow canvas -- navigate only for MVP

## Current Milestone: v1.2 Protocol Registry

**Goal:** Build a declarative protocol definition system where adding a new DeFi protocol requires only a TypeScript definition file -- no step code, no plugin boilerplate.

**Target features:**
- defineProtocol() function with typed protocol definition format
- Auto-generation of IntegrationPlugin + PluginAction[] from protocol definitions
- Generic protocol-read and protocol-write steps that delegate to existing core logic
- ABI auto-resolution from block explorers with in-memory caching
- discover-plugins extended to scan keeperhub/protocols/
- Hub UI: Protocols tab with grid view, detail view, action list
- WETH example protocol definition

## Context

**Architecture (post v1.0):**
- Main app: Next.js 16 + Drizzle ORM + Vercel AI SDK (monorepo at techops-services/keeperhub)
- Events: Node.js services at techops-services/keeperhub-events (independent deploy)
- Scheduler: TypeScript services at techops-services/keeperhub-scheduler (HTTP-only, independent deploy)
- All services deploy to same K8s cluster (maker-staging/maker-prod, keeperhub namespace)

**Plugin System:**
- Core plugins: web3, webhook, discord, sendgrid
- Custom plugins in keeperhub/plugins/
- MCP server integration for AI-powered workflow generation

**Remaining v1.0 cleanup:**
- PR #195 open for monorepo code removal (stability checklist pending)
- git-filter-repo not yet run (deferred)

## Constraints

- **Fork Maintenance**: Custom code in /keeperhub directory with markers in core files
- **Upstream Sync**: Must not break merge path from vercel-labs/workflow-builder-template
- **K8s Deploy**: All services in maker-staging/maker-prod namespaces
- **Lint/Type Safety**: Ultracite/Biome lint + TypeScript strict mode required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| HTTP-only for scheduler | Clean separation, no shared schema dependencies | ✓ Good |
| Events extraction first | Already HTTP-only, simpler migration path | ✓ Good |
| Remove git history | Clean repo without legacy service code | -- Pending (deferred) |
| No rollback to monorepo | Clean break reduces complexity | ✓ Good |
| X-Service-Key auth for internal APIs | Simple, effective for service-to-service | ✓ Good |
| Flat directory structure for scheduler | Simpler, no unnecessary nesting | ✓ Good |
| Change detection for scheduler builds | Only rebuild what changed (dispatcher/executor) | ✓ Good |
| `if: false` for disabling old workflows | Preserves rollback capability | ✓ Good |
| outputFileTracingIncludes for @vercel/og | Forces dynamically-imported WASM into standalone output | ✓ Good |
| Drop Phase 6 from v1.1 | Meta tags/social validation deferred to ship core fix faster | ✓ Good |
| File-based protocol definitions | No DB needed, discover-plugins scans at build time | Good |
| Reuse existing read/write-contract core | Extract to -core.ts pattern, zero new execution code | Good |
| Generic protocol icon for MVP | Custom icons per-protocol added later | Good |
| In-memory ABI cache with 24h TTL | Simple, no external cache dependency | Good |
| Numeric chain ID strings as protocol address keys | Matches chain-select field stored values | Good |

---
*Last updated: 2026-02-20 after Phase 8 (ABI Resolution + Example Protocol)*
