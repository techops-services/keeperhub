# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Users can build and deploy Web3 automation workflows through a visual builder without writing code
**Current focus:** v1.2 Protocol Registry - Phase 6: Foundations

## Current Position

Phase: 6 of 9 (Foundations)
Plan: 2 of TBD in current phase
Status: In progress
Last activity: 2026-02-20 -- completed 06-01 (protocol type definitions) and 06-02 (core extraction)

Progress: [██░░░░░░░░] ~10% (v1.2)

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (v1.0: 12, v1.1: 2, v1.2: 2)
- Average duration: 4 min
- v1.0 total: ~40 min
- v1.1 total: ~10 min
- v1.2 so far: ~8 min (2 plans)

## Accumulated Context

### Decisions

- outputFileTracingIncludes for @vercel/og: forces dynamically-imported WASM into standalone
- Phase 6 dropped from v1.1: meta tags/social validation deferred
- File-based protocol definitions (no DB for MVP)
- Reuse existing read/write-contract core via -core.ts extraction
- Generic protocol icon for MVP -- custom icons per-protocol deferred to future
- Core logic files (read-contract-core.ts, write-contract-core.ts) have no "use step" -- only way to share step logic across multiple step files without breaking workflow bundler
- _context type inlined in core input types (no StepInput import) -- step-handler is step-only infrastructure
- defineProtocol() is an identity function (returns def unchanged) -- TypeScript enforces shape at compile time, runtime validates correctness
- Module-level KEBAB_CASE_REGEX and HEX_ADDRESS_REGEX constants used to satisfy Biome useTopLevelRegex rule

### Pending Todos

- [ ] Merge PR #195 (monorepo cleanup) after stability verification
- [ ] Run git-filter-repo after PR merge
- [ ] Fix workflow OG node icons and names not rendering (PR #326 open)
- [ ] Meta tags & social platform validation (deferred from v1.1 Phase 6)

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 06-01-PLAN.md -- protocol type definitions and defineProtocol() function
Resume file: None

**Next action:** Continue Phase 6 plans
