---
phase: quick
plan: 4
subsystem: protocol-plugin
tags: [bug-fix, protocol-registry, step-runtime]
dependency_graph:
  requires: []
  provides: [protocol-step-registry-population]
  affects: [protocol-read-step, protocol-write-step]
tech_stack:
  added: []
  patterns: [side-effect-import-for-registry-population]
key_files:
  created: []
  modified:
    - keeperhub/plugins/protocol/steps/protocol-read.ts
    - keeperhub/plugins/protocol/steps/protocol-write.ts
decisions:
  - side-effect import in step files is the minimal correct fix -- avoids restructuring the registry or duplicating protocol definitions
metrics:
  duration: ~4 min
  completed: 2026-02-20T04:01:23Z
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 4: Fix Unknown Protocol WETH Error in Workflow Execution Summary

**One-liner:** Side-effect import of protocols barrel added to both protocol step files so registry is populated before `getProtocol()` is called at step runtime.

## What Was Done

Protocol step files (`protocol-read.ts`, `protocol-write.ts`) call `getProtocol(slug)` against an in-memory `protocolRegistry` Map. The Map was empty at step execution time because the side-effect import chain that calls `registerProtocol()` — triggered via `keeperhub/protocols/index.ts` — was not part of the step files' import graph.

The step files are dynamically imported by the step registry at runtime, independent of the plugin import chain that runs at server startup. Adding `import "@/keeperhub/protocols"` as a side-effect import to both step files ensures the barrel runs `registerProtocol(wethDef)` before any `getProtocol()` call in the step function body.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add protocol registration side-effect import to both step files | a292c8563 | protocol-read.ts, protocol-write.ts |

## Verification

- Both step files contain `import "@/keeperhub/protocols"` at line 2 (after `import "server-only"`)
- `pnpm check` passes (lint clean, 469 files, no fixes applied)
- `pnpm type-check` pre-existing failure in `keeperhub/plugins/safe/index.ts` (out of scope -- see Deferred Issues)
- `pnpm build` succeeds (bundler handles the new import correctly)

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Issues

**Pre-existing type error (out of scope):**
- File: `keeperhub/plugins/safe/index.ts`
- Error: `Type '"safe"' is not assignable to type 'IntegrationType'`
- Confirmed pre-existing on HEAD before this task's changes
- Cause: `safe` integration type likely missing from auto-generated `lib/types/integration.ts`; needs `pnpm discover-plugins` run or manual type registration

## Self-Check: PASSED

- `/Users/skp/Dev/TechOps Services/keeperhub/keeperhub/plugins/protocol/steps/protocol-read.ts` -- contains `import "@/keeperhub/protocols"` at line 2
- `/Users/skp/Dev/TechOps Services/keeperhub/keeperhub/plugins/protocol/steps/protocol-write.ts` -- contains `import "@/keeperhub/protocols"` at line 2
- Commit `a292c8563` exists in git log
