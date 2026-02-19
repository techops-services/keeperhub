---
phase: 06-foundations
plan: 02
subsystem: api
tags: [web3, ethers, plugins, refactoring, bundler]

requires:
  - phase: 06-foundations
    provides: Plan 01 context -- decode-calldata-core.ts pattern established

provides:
  - read-contract-core.ts with readContractCore function, ReadContractCoreInput type, ReadContractResult type
  - write-contract-core.ts with writeContractCore function, WriteContractCoreInput type, WriteContractResult type
  - Thin step wrappers for read-contract.ts and write-contract.ts that delegate to core functions

affects:
  - 07-protocol-steps (needs readContractCore and writeContractCore for protocol-read/protocol-write steps)

tech-stack:
  added: []
  patterns:
    - "-core.ts extraction pattern: move step logic to a non-step file so it can be imported by multiple step files without violating bundler constraints"

key-files:
  created:
    - keeperhub/plugins/web3/steps/read-contract-core.ts
    - keeperhub/plugins/web3/steps/write-contract-core.ts
  modified:
    - keeperhub/plugins/web3/steps/read-contract.ts
    - keeperhub/plugins/web3/steps/write-contract.ts

key-decisions:
  - "Core logic files have no 'use step' directive -- this is the only way to share step logic across multiple step files without breaking the workflow bundler"
  - "_context type inlined in WriteContractCoreInput as optional (executionId, triggerType) so the core file has no dependency on StepInput from step-handler"

patterns-established:
  - "-core.ts pattern: extract stepHandler to *Core function in *-core.ts (no 'use step'), step wrapper does enrichment + metrics + logging + delegates to core"
  - "Core file imports: server-only, db, ethers, rpc, explorer -- NO step-handler, NO plugin metrics"
  - "Step wrapper imports: StepInput, withStepLogging, withPluginMetrics, plus enrichment-only deps (getChainIdFromNetwork, explorerConfigs, getAddressUrl)"

requirements-completed:
  - CORE-01
  - CORE-02
  - CORE-03
  - CORE-04

duration: 4min
completed: 2026-02-20
---

# Phase 6 Plan 02: Core Extraction Summary

**Read and write contract core logic extracted to -core.ts files (no "use step"), enabling Phase 7 protocol steps to reuse ethers/RPC execution logic without bundler violations**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-19T13:55:27Z
- **Completed:** 2026-02-19T13:58:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extracted `stepHandler` from `read-contract.ts` into `readContractCore` in `read-contract-core.ts` without "use step"
- Extracted `stepHandler` from `write-contract.ts` into `writeContractCore` in `write-contract-core.ts` without "use step"
- Reduced both step files to thin wrappers: enrichment (contractAddressLink) + metrics + logging + delegation
- All 51 batch-read-contract tests continue to pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract read-contract core logic** - `f72db61a2` (refactor)
2. **Task 2: Extract write-contract core logic** - `ef55ac2ff` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `keeperhub/plugins/web3/steps/read-contract-core.ts` - Core read contract logic: readContractCore, ReadContractCoreInput, ReadContractResult. No "use step".
- `keeperhub/plugins/web3/steps/write-contract-core.ts` - Core write contract logic: writeContractCore, WriteContractCoreInput, WriteContractResult. No "use step".
- `keeperhub/plugins/web3/steps/read-contract.ts` - Now a thin wrapper: enriches input with contractAddressLink, wraps in metrics + logging, delegates to readContractCore
- `keeperhub/plugins/web3/steps/write-contract.ts` - Now a thin wrapper: enriches input with contractAddressLink, wraps in metrics + logging, delegates to writeContractCore

## Decisions Made

- `_context` type inlined in `WriteContractCoreInput` (as optional `{ executionId?, triggerType? }`) to avoid importing `StepInput` from `@/lib/steps/step-handler` in the core file -- step-handler is step-only infrastructure
- `ReadContractCoreInput._context` also inlined as optional for the same reason
- Both core files have `import "server-only"` per the decode-calldata-core.ts pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Biome formatter required import reordering in `read-contract.ts` (relative imports must come after absolute path imports). Fixed via `pnpm fix` auto-correction.

## Next Phase Readiness

- `readContractCore` and `writeContractCore` are ready to import from Phase 7 protocol-read and protocol-write steps
- Both functions accept `_context` with optional `executionId` and `triggerType` -- matches what protocol steps will pass
- No blockers

---
*Phase: 06-foundations*
*Completed: 2026-02-20*
