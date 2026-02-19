# Requirements: KeeperHub v1.2 Protocol Registry

**Defined:** 2026-02-20
**Core Value:** Users can build and deploy Web3 automation workflows through a visual builder without writing code

## v1.2 Requirements

Requirements for Protocol Registry milestone. Each maps to roadmap phases.

### Protocol Definition

- [ ] **PDEF-01**: Developer can define a protocol via `defineProtocol()` with typed protocol definition object
- [ ] **PDEF-02**: Protocol definitions live in `keeperhub/protocols/{protocol-slug}.ts` (one file per protocol)
- [ ] **PDEF-03**: Protocol definition declares contracts with per-chain addresses
- [ ] **PDEF-04**: Protocol definition declares actions with inputs, outputs, and contract references
- [ ] **PDEF-05**: At least one example protocol definition included (WETH wrap/unwrap)

### Core Logic Extraction

- [ ] **CORE-01**: Read-contract core logic extracted to `read-contract-core.ts` (no `"use step"`)
- [ ] **CORE-02**: Write-contract core logic extracted to `write-contract-core.ts` (no `"use step"`)
- [ ] **CORE-03**: Original read-contract step imports from read-contract-core.ts
- [ ] **CORE-04**: Original write-contract step imports from write-contract-core.ts

### Plugin Auto-Generation

- [ ] **PLUG-01**: Each protocol becomes an IntegrationPlugin with auto-generated PluginAction[] entries
- [ ] **PLUG-02**: Protocol actions appear in the workflow builder as nodes (e.g., "Compound: Supply")
- [ ] **PLUG-03**: Protocol actions appear in MCP schemas endpoint (`/api/mcp/schemas`)
- [ ] **PLUG-04**: `pnpm discover-plugins` extended to scan `keeperhub/protocols/` and auto-generate registrations
- [ ] **PLUG-05**: Step-registry entries generated pointing to protocol-read/protocol-write

### Protocol Steps

- [ ] **STEP-01**: Generic protocol-read step delegates to read-contract core logic
- [ ] **STEP-02**: Generic protocol-write step delegates to write-contract core logic
- [ ] **STEP-03**: Protocol steps resolve contract address for selected network from protocol definition
- [ ] **STEP-04**: Protocol steps resolve ABI (from definition or auto-fetch) before calling core logic

### ABI Resolution

- [ ] **ABI-01**: ABI auto-fetched from block explorer when omitted from protocol definition
- [ ] **ABI-02**: Proxy detection reuses existing fetch-abi logic (EIP-1967, EIP-1822, EIP-2535)
- [ ] **ABI-03**: Fetched ABIs cached in memory with 24-hour TTL

### Hub UI

- [ ] **UI-01**: Hub page has tab switcher: Workflows (default) | Protocols
- [ ] **UI-02**: Protocol grid shows cards with icon, name, description, chain badges, action counts
- [ ] **UI-03**: Protocol card click shows inline detail view with action list
- [ ] **UI-04**: Each action row shows name, type badge (READ/WRITE), chain badges, description
- [ ] **UI-05**: "Use in Workflow" button navigates to workflow builder
- [ ] **UI-06**: Protocol grid matches existing workflow template grid styling exactly

## Future Requirements

### Protocol Ecosystem

- **PECO-01**: Custom icons per protocol (icon.tsx in protocol directory)
- **PECO-02**: Hub sidebar chain filter for protocols
- **PECO-03**: Token metadata auto-detection (symbols, decimals)
- **PECO-04**: Protocol version management (v2/v3 of same protocol)
- **PECO-05**: Action pre-insertion into workflow canvas from "Use in Workflow"
- **PECO-06**: Database storage for protocol definitions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Protocol submission/creation UI | Definition files only, developer workflow |
| Action execution from Hub | Execution happens in workflows only |
| Protocol detail page (separate route) | Inline expansion only |
| Favorites or pinning | Not needed for MVP |
| Analytics/usage counts on cards | Future enhancement |
| Level 2/3 custom steps per protocol | Built per-protocol when needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDEF-01 | Phase 6 | Pending |
| PDEF-02 | Phase 6 | Pending |
| PDEF-03 | Phase 6 | Pending |
| PDEF-04 | Phase 6 | Pending |
| PDEF-05 | Phase 8 | Pending |
| CORE-01 | Phase 6 | Pending |
| CORE-02 | Phase 6 | Pending |
| CORE-03 | Phase 6 | Pending |
| CORE-04 | Phase 6 | Pending |
| PLUG-01 | Phase 7 | Pending |
| PLUG-02 | Phase 7 | Pending |
| PLUG-03 | Phase 7 | Pending |
| PLUG-04 | Phase 7 | Pending |
| PLUG-05 | Phase 7 | Pending |
| STEP-01 | Phase 7 | Pending |
| STEP-02 | Phase 7 | Pending |
| STEP-03 | Phase 7 | Pending |
| STEP-04 | Phase 7 | Pending |
| ABI-01 | Phase 8 | Pending |
| ABI-02 | Phase 8 | Pending |
| ABI-03 | Phase 8 | Pending |
| UI-01 | Phase 9 | Pending |
| UI-02 | Phase 9 | Pending |
| UI-03 | Phase 9 | Pending |
| UI-04 | Phase 9 | Pending |
| UI-05 | Phase 9 | Pending |
| UI-06 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap creation*
