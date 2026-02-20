---
phase: quick-7
plan: "01"
subsystem: developer-tooling
tags: [slash-command, protocol-plugins, developer-experience]
dependency_graph:
  requires: [keeperhub/protocols/weth.ts, keeperhub/lib/protocol-registry.ts]
  provides: [.claude/commands/add-protocol.md]
  affects: [future protocol additions]
tech_stack:
  added: []
  patterns: [slash-command, xml-structured-prompt, dynamic-context-loading]
key_files:
  created:
    - .claude/commands/add-protocol.md
  modified: []
decisions:
  - "Embedded WETH reference implementation inline in the command to avoid requiring Claude to discover the pattern each time"
  - "Used absolute path in ls command for dynamic context to ensure it works from any working directory"
  - "Included F-049 spec reference to show Claude what a spec file looks like without loading it every invocation"
metrics:
  duration: "1 minute"
  completed: "2026-02-20"
  tasks_completed: 1
  files_created: 1
---

# Quick Task 7: /add-protocol Slash Command Summary

One-liner: `/add-protocol` slash command encoding the complete KeeperHub protocol plugin system (defineProtocol shape, validation rules, chain IDs, ABI auto-fetch, WETH reference, post-creation steps).

## What Was Built

Created `.claude/commands/add-protocol.md` -- a slash command that gives Claude Code complete knowledge of the protocol plugin system so it can create new protocol definitions without asking clarifying questions about file structure or conventions.

The command encodes:
- The complete `defineProtocol()` type shape with all fields and their types
- Validation rules enforced at import time (slugs, addresses, contract references)
- Chain IDs for all supported networks (Ethereum, Base, Arbitrum, Optimism)
- ABI auto-fetch behavior and when to omit vs include the `abi` field
- Icon download/copy workflow
- The WETH reference implementation embedded as a canonical example
- Step-by-step process for both spec-file and interview modes
- Post-creation steps in the required order: discover-plugins, check, type-check

## Dual-Mode Operation

- `/add-protocol specs/F-049-sky-protocol-plugin.md` -- reads spec file, extracts all protocol details, creates definition with no clarifying questions
- `/add-protocol Aave` -- interviews user for contracts, chains, and actions, then creates definition
- `/add-protocol` (no args) -- asks user what protocol to add

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create /add-protocol slash command | 2c890bc3b | .claude/commands/add-protocol.md |

## Self-Check: PASSED

- `.claude/commands/add-protocol.md` exists: FOUND
- YAML frontmatter with description and argument-hint: FOUND
- `<objective>` tag with $ARGUMENTS reference: FOUND
- `<context>` tag with @weth.ts and @protocol-registry.ts references: FOUND
- `<architecture>` tag with complete defineProtocol() shape: FOUND
- `<process>` tag with numbered steps: FOUND
- `<verification>` tag with post-creation checks: FOUND
- `<success_criteria>` tag: FOUND
- `pnpm discover-plugins` in process: FOUND (4 occurrences)
- No emojis: PASS
- Commit 2c890bc3b exists: VERIFIED
