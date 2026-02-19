# Roadmap: KeeperHub

## Milestones

- ✅ **v1.0 Service Extraction** - Phases 1-4 (shipped 2026-02-12)
- ✅ **v1.1 OG Image Generation** - Phase 5 (shipped 2026-02-12)
- 🚧 **v1.2 Protocol Registry** - Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Service Extraction (Phases 1-4) - SHIPPED 2026-02-12</summary>

- [x] Phase 1: Events Extraction - completed 2026-01-25
- [x] Phase 2: Scheduler APIs (5/5 plans) - completed 2026-01-26
- [x] Phase 3: Scheduler Extraction (4/4 plans) - completed 2026-01-26
- [x] Phase 4: Cleanup (3/3 plans) - completed 2026-02-12

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 OG Image Generation (Phase 5) - SHIPPED 2026-02-12</summary>

- [x] Phase 5: Build & Local Validation (2/2 plans) - completed 2026-02-12

Phase 6 (Meta Tags & Social Validation) dropped from scope -- deferred to future milestone.

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

### v1.2 Protocol Registry (In Progress)

**Milestone Goal:** Build a declarative protocol definition system where adding a new DeFi protocol requires only a TypeScript definition file -- no step code, no plugin boilerplate.

- [x] **Phase 6: Foundations** - Protocol types, defineProtocol() function, read/write-contract core extraction (completed 2026-02-19)
- [ ] **Phase 7: Plugin Auto-Generation** - protocolToPlugin(), generic protocol steps, discover-plugins extension
- [ ] **Phase 8: ABI Resolution + Example Protocol** - ABI auto-fetch with caching, WETH example definition
- [ ] **Phase 9: Hub UI** - Protocols tab, protocol grid, inline detail view, action rows

## Phase Details

### Phase 6: Foundations
**Goal**: The protocol definition system has a typed API and the core contract logic is safely extracted for reuse
**Depends on**: Phase 5
**Requirements**: PDEF-01, PDEF-02, PDEF-03, PDEF-04, CORE-01, CORE-02, CORE-03, CORE-04
**Success Criteria** (what must be TRUE):
  1. Developer can call `defineProtocol()` with a typed object and TypeScript validates the shape
  2. Protocol files live in `keeperhub/protocols/{slug}.ts` following the declared convention
  3. Protocol definition declares contracts with per-chain addresses and actions with inputs, outputs, and contract references
  4. Original read-contract and write-contract steps continue to pass all existing tests after core extraction
**Plans:** 2/2 plans complete
Plans:
- [ ] 06-01-PLAN.md -- Protocol definition types and defineProtocol() function with runtime validation
- [ ] 06-02-PLAN.md -- Core logic extraction from read-contract and write-contract steps

### Phase 7: Plugin Auto-Generation
**Goal**: Every protocol definition automatically appears as workflow nodes in the builder and in the MCP schemas endpoint
**Depends on**: Phase 6
**Requirements**: PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, STEP-01, STEP-02, STEP-03, STEP-04
**Success Criteria** (what must be TRUE):
  1. Running `pnpm discover-plugins` scans `keeperhub/protocols/` and generates plugin registrations without manual intervention
  2. Protocol actions appear in the workflow builder node palette (e.g., "WETH: Wrap", "WETH: Unwrap")
  3. Protocol actions appear in the `/api/mcp/schemas` response
  4. Generic protocol-read and protocol-write steps resolve the correct contract address for the selected network at runtime
**Plans:** 3 plans
Plans:
- [ ] 07-01-PLAN.md -- protocolToPlugin() conversion, runtime protocol registry, protocol plugin shell + icon
- [ ] 07-02-PLAN.md -- Generic protocol-read and protocol-write step files
- [ ] 07-03-PLAN.md -- Extend discover-plugins to scan protocols and auto-register

### Phase 8: ABI Resolution + Example Protocol
**Goal**: Protocols without an ABI in their definition resolve one automatically, and WETH demonstrates the full system end-to-end
**Depends on**: Phase 7
**Requirements**: ABI-01, ABI-02, ABI-03, PDEF-05
**Success Criteria** (what must be TRUE):
  1. A protocol definition with no ABI field still executes correctly by fetching the ABI from a block explorer
  2. Proxy contracts (EIP-1967, EIP-1822, EIP-2535) resolve to the implementation ABI automatically
  3. Fetched ABIs are not re-fetched within 24 hours (cache hit observable via logs or reduced network calls)
  4. The WETH protocol definition exists and its wrap/unwrap actions are available in the workflow builder
**Plans**: TBD

### Phase 9: Hub UI
**Goal**: Users can browse all registered protocols from the Hub, inspect their actions, and navigate to the workflow builder to use them
**Depends on**: Phase 8
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. The Hub page has a tab switcher with Workflows (default) and Protocols tabs that toggle the visible grid
  2. The Protocols tab shows a grid of protocol cards matching the workflow template grid styling, each showing icon, name, description, chain badges, and action count
  3. Clicking a protocol card reveals an inline detail view listing each action with name, type badge (READ/WRITE), chain badges, and description
  4. Each action row has a "Use in Workflow" button that navigates to the workflow builder
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Events Extraction | v1.0 | Done | Complete | 2026-01-25 |
| 2. Scheduler APIs | v1.0 | 5/5 | Complete | 2026-01-26 |
| 3. Scheduler Extraction | v1.0 | 4/4 | Complete | 2026-01-26 |
| 4. Cleanup | v1.0 | 3/3 | Complete | 2026-02-12 |
| 5. Build & Local Validation | v1.1 | 2/2 | Complete | 2026-02-12 |
| 6. Foundations | v1.2 | 2/2 | Complete | 2026-02-19 |
| 7. Plugin Auto-Generation | v1.2 | 0/3 | Not started | - |
| 8. ABI Resolution + Example Protocol | v1.2 | 0/TBD | Not started | - |
| 9. Hub UI | v1.2 | 0/TBD | Not started | - |
