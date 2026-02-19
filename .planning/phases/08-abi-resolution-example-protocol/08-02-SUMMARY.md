---
phase: 08-abi-resolution-example-protocol
plan: 02
subsystem: api
tags: [weth, protocol, web3, multi-chain, defineProtocol]

requires:
  - phase: 08-abi-resolution-example-protocol
    provides: resolveAbi() for ABI auto-fetch when omitted from definitions
provides:
  - Production WETH protocol definition with multi-chain addresses
  - End-to-end validation of protocol registry system
affects: [09-hub-ui]

tech-stack:
  added: []
  patterns: [protocol definition with numeric chain ID keys matching chain-select values]

key-files:
  created:
    - keeperhub/protocols/weth.ts
  modified:
    - keeperhub/protocols/index.ts

key-decisions:
  - "Address keys use numeric chain ID strings (e.g., '1', '8453') matching chain-select field values, not named keys like 'ethereum-mainnet'"
  - "Omitted Polygon WETH -- that address is actually WMATIC which is semantically different"
  - "ABI intentionally omitted to exercise auto-fetch from Plan 08-01"

patterns-established:
  - "Protocol address keys: use numeric chain ID strings matching chain-select stored values"

requirements-completed: [PDEF-05]

duration: 3min
completed: 2026-02-20
---

# Plan 08-02: WETH Protocol Definition Summary

**Production WETH protocol with 4-chain support (Ethereum, Base, Arbitrum, Optimism), 3 actions (wrap/unwrap/balanceOf), ABI omitted for auto-fetch**

## Performance

- **Duration:** 3 min
- **Completed:** 2026-02-20
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created production WETH protocol definition with multi-chain addresses
- Removed test-weth.ts placeholder
- Regenerated protocols barrel via discover-plugins

## Task Commits

Each task was committed atomically:

1. **Task 1: Create production WETH protocol and remove test placeholder** - `43bc783` (feat)

## Files Created/Modified
- `keeperhub/protocols/weth.ts` - Production WETH definition with 4 chains, 3 actions, no inline ABI
- `keeperhub/protocols/index.ts` - Auto-regenerated barrel importing from ./weth

## Decisions Made
- Used numeric chain ID strings as address keys (e.g., "1", "8453") because chain-select field stores chainId as string
- Omitted Polygon -- the address 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270 is WMATIC, not WETH
- ABI intentionally omitted to exercise the auto-fetch path from Plan 08-01

## Deviations from Plan

### Auto-fixed Issues

**1. Address key format correction**
- **Found during:** Task 1 (WETH protocol creation)
- **Issue:** Plan suggested "ethereum-mainnet" as address key, but chain-select stores numeric chain IDs as strings (e.g., "1")
- **Fix:** Used numeric chain ID strings as address keys to match runtime lookup in protocol steps
- **Files modified:** keeperhub/protocols/weth.ts
- **Verification:** Traced chain-select field value through protocol-read/write address lookup
- **Committed in:** 43bc783

---

**Total deviations:** 1 auto-fixed (address key format)
**Impact on plan:** Necessary for correctness -- addresses must match the runtime lookup key.

## Issues Encountered
- discover-plugins failed on first run because old barrel still referenced ./test-weth -- fixed barrel import before re-running

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full protocol registry system validated end-to-end with WETH
- Ready for Phase 9 (Hub UI) which displays registered protocols

---
*Phase: 08-abi-resolution-example-protocol*
*Completed: 2026-02-20*
