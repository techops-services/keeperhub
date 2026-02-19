---
phase: 09-hub-ui
plan: 01
subsystem: ui
tags: [react, tabs, protocol-registry, next-api, shadcn]

requires:
  - phase: 08-abi-resolution-example-protocol
    provides: Protocol registry with WETH definition and getRegisteredProtocols()
provides:
  - GET /api/protocols endpoint serving registered protocol definitions as JSON
  - chain-utils.ts mapping numeric chain IDs to human-readable names
  - Hub page tab switcher with Workflows and Protocols tabs
  - Protocol grid with filterable cards matching workflow template styling
affects: [09-02-protocol-detail]

tech-stack:
  added: []
  patterns: [underline-style tabs via className overrides on shadcn Tabs]

key-files:
  created:
    - keeperhub/api/protocols/route.ts
    - app/api/protocols/route.ts
    - keeperhub/lib/chain-utils.ts
    - keeperhub/components/hub/protocol-grid.tsx
  modified:
    - keeperhub/components/hub/protocol-card.tsx
    - app/hub/page.tsx

key-decisions:
  - "Protocol API is synchronous (no async) -- registry populated at import time via side-effect"
  - "chain-utils.ts is client-safe with no server imports"
  - "Underline-style tabs via className overrides rather than custom Tabs variant"
  - "Standalone inline search input for protocols instead of reusing WorkflowSearchFilter"
  - "_selectedProtocol underscore prefix for unused destructured state -- Plan 02 consumes it"

patterns-established:
  - "Protocol API thin wrapper pattern: keeperhub/api → app/api re-export"
  - "Underline tab styling: border-b-2 with data-[state=active]:border-[#09fd67]"

requirements-completed: [UI-01, UI-02, UI-06]

duration: 5min
completed: 2026-02-20
---

# Plan 09-01: Protocol API, Tab Switcher, and Protocol Grid

**Hub page tab switcher with Protocols grid showing filterable cards, protocol API endpoint, and chain name utility**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-02-20
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments
- GET /api/protocols endpoint returns registered protocol definitions as JSON
- Chain utility maps numeric chain IDs (e.g., "1") to human-readable names (e.g., "Ethereum")
- Hub page has underline-style tab switcher with Workflows (default) and Protocols tabs
- Protocol grid renders filterable cards matching workflow template card styling exactly
- Protocol cards show human-readable chain badges with max-3 overflow tooltip

## Task Commits

Each task was committed atomically:

1. **Task 1: Protocol API endpoint and chain utility** - `44df7ed84` (feat)
2. **Task 2: Protocol grid and updated protocol card** - `4e3a780b5` (feat)
3. **Task 3: Hub page tab switcher** - `ad0e0bf2b` (feat)

## Files Created/Modified
- `keeperhub/lib/chain-utils.ts` - Maps numeric chain ID strings to human-readable names
- `keeperhub/api/protocols/route.ts` - GET endpoint returning protocol definitions as JSON
- `app/api/protocols/route.ts` - Thin wrapper re-exporting from keeperhub
- `keeperhub/components/hub/protocol-grid.tsx` - Filterable protocol card grid component
- `keeperhub/components/hub/protocol-card.tsx` - Updated to use getChainName for readable badges
- `app/hub/page.tsx` - Tab switcher, protocol state, protocol search, protocol fetch

## Decisions Made
- Protocol API is synchronous (no async/await) since registry is populated at import time
- chain-utils.ts covers all chains from CHAIN_CONFIG in rpc-config.ts with fallback for unknown IDs
- Standalone inline search for protocols rather than extending WorkflowSearchFilter
- _selectedProtocol uses underscore prefix since Plan 02 will consume the value

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Protocol grid renders and is selectable via onSelect callback
- selectedProtocol state is wired and ready for Plan 02 to render ProtocolDetail
- All chain name mapping infrastructure in place for detail view

---
*Phase: 09-hub-ui*
*Completed: 2026-02-20*
