---
phase: 07-plugin-auto-generation
plan: "01"
subsystem: api
tags: [protocol, plugin, registry, web3, lucide-react]

requires:
  - phase: 06-foundations
    provides: ProtocolDefinition type, defineProtocol() validation, ProtocolAction/ProtocolContract types

provides:
  - protocolToPlugin() converting ProtocolDefinition to IntegrationPlugin
  - protocolActionToPluginAction() with chain-select + input fields + hidden _protocolMeta
  - Runtime registry: registerProtocol, getProtocol, getRegisteredProtocols
  - Protocol plugin shell at keeperhub/plugins/protocol/ with ProtocolIcon

affects:
  - 07-plugin-auto-generation (plans 02, 03)
  - discover-plugins script (Plan 03)
  - protocol-read/protocol-write steps (Plan 02)

tech-stack:
  added: []
  patterns:
    - "Protocol plugin pattern: protocolToPlugin() generates IntegrationPlugin dynamically from ProtocolDefinition"
    - "Hidden _protocolMeta field stores JSON with protocolSlug, contractKey, functionName, actionType for step execution"
    - "buildConfigFieldsFromAction / buildOutputFieldsFromAction helpers keep protocolActionToPluginAction under complexity limit"

key-files:
  created:
    - keeperhub/plugins/protocol/icon.tsx
    - keeperhub/plugins/protocol/index.ts
  modified:
    - keeperhub/lib/protocol-registry.ts

key-decisions:
  - "protocolToPlugin imports ProtocolIcon directly (no icon parameter) -- single canonical icon for all protocol plugins at MVP"
  - "Plugin shell index.ts does not call registerIntegration() -- registration is handled by discover-plugins (Plan 03)"
  - "_protocolMeta field uses type=text with defaultValue containing JSON -- UI hides underscore-prefixed fields"

patterns-established:
  - "Protocol-to-plugin conversion: one protocolToPlugin() call produces a complete IntegrationPlugin ready for registerIntegration()"
  - "Config field builder helpers: extract buildConfigFieldsFromAction() and buildOutputFieldsFromAction() to keep cognitive complexity under 15"

requirements-completed: [PLUG-01]

duration: 2min
completed: 2026-02-20
---

# Phase 7 Plan 01: Plugin Auto-Generation Foundation Summary

**protocolToPlugin() and runtime registry added to protocol-registry.ts, with Box-icon protocol plugin shell for discover-plugins detection**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-19T14:22:39Z
- **Completed:** 2026-02-19T14:24:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added runtime Map-based registry (registerProtocol, getProtocol, getRegisteredProtocols) to protocol-registry.ts
- Added protocolActionToPluginAction() producing PluginAction with chain-select field, per-input template fields, and hidden _protocolMeta containing JSON metadata
- Added protocolToPlugin() converting any ProtocolDefinition to a complete IntegrationPlugin using ProtocolIcon
- Created keeperhub/plugins/protocol/ directory with icon.tsx (Box from lucide-react) and shell index.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add protocolToPlugin conversion and runtime registry** - `679cc94e3` (feat)
2. **Task 2: Create protocol plugin shell and icon** - `bf253f6a4` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `keeperhub/lib/protocol-registry.ts` - Added registry functions, protocolActionToPluginAction, protocolToPlugin, helper builders; imports from @/plugins/registry and @/lib/types/integration
- `keeperhub/plugins/protocol/icon.tsx` - ProtocolIcon component wrapping lucide-react Box
- `keeperhub/plugins/protocol/index.ts` - Plugin shell re-exporting ProtocolIcon; explains that registration is handled by discover-plugins

## Decisions Made

- protocolToPlugin() imports ProtocolIcon directly rather than accepting it as a parameter -- single canonical icon for all protocol plugins at MVP keeps the API simple
- Plugin shell index.ts does NOT call registerIntegration() -- dynamic registration happens in discover-plugins (Plan 03), not at import time
- _protocolMeta field uses type="text" with JSON defaultValue -- the UI convention is to hide underscore-prefixed fields automatically

## Deviations from Plan

None - plan executed exactly as written. `pnpm fix` reformatted two files (formatter-only changes, no logic modifications).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- protocolToPlugin() is ready for Plan 02 (protocol step files: protocol-read, protocol-write)
- Protocol plugin shell is in place for Plan 03 (discover-plugins integration)
- Runtime registry can receive registerProtocol() calls from protocol definition files

## Self-Check: PASSED

- keeperhub/lib/protocol-registry.ts: FOUND
- keeperhub/plugins/protocol/icon.tsx: FOUND
- keeperhub/plugins/protocol/index.ts: FOUND
- .planning/phases/07-plugin-auto-generation/07-01-SUMMARY.md: FOUND
- Commit 679cc94e3 (Task 1): FOUND
- Commit bf253f6a4 (Task 2): FOUND
