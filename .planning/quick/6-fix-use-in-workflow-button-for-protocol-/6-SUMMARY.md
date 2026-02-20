---
phase: quick-6
plan: "01"
subsystem: hub-ui
tags: [protocol, workflow, navigation, ux]
dependency_graph:
  requires: []
  provides: [use-in-workflow-button]
  affects: [keeperhub/components/hub/protocol-detail.tsx]
tech_stack:
  added: []
  patterns: [nanoid-for-node-ids, api-workflow-create, anonymous-session-fallback]
key_files:
  modified:
    - keeperhub/components/hub/protocol-detail.tsx
decisions:
  - "Use protocol.slug/action.slug as actionType ID to match computeActionId format in plugin registry"
  - "Set data.label to protocol+action label so action node displays correctly before config panel loads"
  - "Do not set _protocolMeta in initial config -- node-config-panel auto-persists defaults when action is recognized"
  - "Track creatingActionSlug (not boolean) to support per-row loading state across multiple actions"
metrics:
  duration: "5 min"
  completed: "2026-02-20T05:19:51Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 6: Fix Use in Workflow Button for Protocol Actions Summary

**One-liner:** Replace stub `router.push("/")` with async workflow creation handler that pre-configures a Manual trigger + protocol action node and navigates to the new workflow.

## What Was Done

The "Use in Workflow" button on protocol detail action rows previously navigated to `/` (app root) with no context. The button now:

1. Sets per-action loading state (`creatingActionSlug`) to disable the button and show "Creating..." text
2. Ensures an anonymous session exists (matching the pattern in `app/page.tsx`)
3. Builds a trigger node (Manual) and action node with `config.actionType` set to `${protocol.slug}/${action.slug}` (e.g., `weth/balance-of`)
4. Sets `data.label` to `${protocol.name}: ${action.label}` (e.g., "WETH: Get Balance") for immediate correct display
5. Calls `api.workflow.create()` with the pre-built nodes and edge
6. Sets `sessionStorage.animate-sidebar` and navigates to `/workflows/${newWorkflow.id}`
7. On error: shows `toast.error("Failed to create workflow")` and resets loading state

## Files Modified

- `keeperhub/components/hub/protocol-detail.tsx` — Added imports (`nanoid`, `api`, `authClient`, `useSession`, `useState`, `toast`, `ProtocolAction`), added `handleUseInWorkflow` async function, updated Button element with loading state and disabled prop

## Deviations from Plan

None — plan executed exactly as written. Implementation was already present in HEAD (committed as part of quick-5 work on the same branch), verified by checksum comparison.

## Self-Check

- [x] `keeperhub/components/hub/protocol-detail.tsx` exists and contains `handleUseInWorkflow`
- [x] Commit 8eef836a1 exists with the implementation
- [x] `pnpm check` passes (0 errors)
- [x] `pnpm type-check` passes (0 errors)
- [x] Button navigates to `/workflows/${newWorkflow.id}` not `/`

## Self-Check: PASSED
