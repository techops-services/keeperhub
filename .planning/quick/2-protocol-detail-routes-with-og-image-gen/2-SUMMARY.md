---
phase: quick
plan: 2
subsystem: hub-ui
tags: [protocols, og-images, routing, metadata]
dependency-graph:
  requires: [protocol-registry, hub-protocols-tab]
  provides: [shareable-protocol-urls, protocol-og-images]
  affects: [hub-page, protocol-detail]
tech-stack:
  added: []
  patterns: [next-metadata-api, dynamic-og-generation, client-navigation]
key-files:
  created:
    - keeperhub/api/protocols/[slug]/route.ts
    - app/api/protocols/[slug]/route.ts
    - keeperhub/app/hub/protocol/[slug]/page.tsx
    - app/hub/protocol/[slug]/page.tsx
    - keeperhub/components/hub/protocol-detail-page.tsx
    - app/api/og/protocol/[slug]/route.tsx
  modified:
    - keeperhub/api/og/generate-og.tsx
    - app/hub/page.tsx
decisions:
  - Dynamic imports in generateProtocolOGImage for server-side registry access
  - 1-hour cache (3600s) for protocol OG images (protocols are static-ish)
  - Chain badges rendered as green-bordered cards matching HUB_CARDS pattern
  - ProtocolDetailPage wrapper includes sidebar margin offset for standalone rendering
  - Hub page navigates to /hub/protocol/[slug] instead of inline detail view
metrics:
  duration: 3 min
  tasks: 2
  files: 8
  commits: 2
  completed: 2026-02-20T00:58:27Z
---

# Quick Task 2: Protocol Detail Routes with OG Image Generation

**One-liner:** Shareable protocol detail pages at /hub/protocol/[slug] with dynamic OG images showing protocol name, description, chains, and action counts.

## What Was Built

Added dedicated protocol detail pages with shareable URLs and rich OG metadata for social sharing:

1. **Single Protocol API** (`/api/protocols/[slug]`)
   - Returns protocol definition JSON by slug
   - 404 if protocol not found
   - Server-side registry lookup via side-effect import

2. **Protocol OG Image Generation** (`/api/og/protocol/[slug]`)
   - Dynamic OG image (1200x630) per protocol
   - Protocol name with ICON_GLOBE icon
   - Description (cleaned: " -- " → ". ")
   - Chain badges as green-bordered cards
   - Footer: action counts (total, write, read)
   - 1-hour cache for static-ish protocol data

3. **Protocol Detail Page** (`/hub/protocol/[slug]`)
   - Server component with generateMetadata for OG tags
   - Dynamic title: `${protocol.name} Protocol | KeeperHub`
   - OG image URL: `/api/og/protocol/${slug}`
   - Twitter card: summary_large_image
   - Client wrapper (ProtocolDetailPage) for navigation

4. **Hub Page Navigation**
   - Removed inline protocol detail rendering
   - Removed `selectedProtocol` state
   - Protocol cards navigate to `/hub/protocol/[slug]`
   - "Back to Protocols" navigates to `/hub?tab=protocols`

## Task Breakdown

### Task 1: Single-protocol API route and OG image generation
**Duration:** 1.5 min | **Commit:** e69d88ece

Created single-protocol API endpoint and OG image generation:
- `keeperhub/api/protocols/[slug]/route.ts` - API route implementation
- `app/api/protocols/[slug]/route.ts` - Thin wrapper
- `keeperhub/api/og/generate-og.tsx` - Added `generateProtocolOGImage()` function
- `app/api/og/protocol/[slug]/route.tsx` - OG route wrapper

**Key implementation details:**
- Dynamic imports for protocol registry (side-effect registration)
- Chain badge layout similar to HUB_CARDS pattern
- Action count footer: total, write, read
- 1-hour cache for protocol OG images

### Task 2: Protocol detail page route with metadata
**Duration:** 1.5 min | **Commit:** c8818db5f

Created protocol detail page route and updated hub navigation:
- `keeperhub/app/hub/protocol/[slug]/page.tsx` - Server component with generateMetadata
- `app/hub/protocol/[slug]/page.tsx` - Thin wrapper
- `keeperhub/components/hub/protocol-detail-page.tsx` - Client wrapper with navigation
- `app/hub/page.tsx` - Updated to navigate instead of inline detail

**Key changes:**
- Removed `selectedProtocol` state and `selectedProtocolDef` variable
- Removed inline `ProtocolDetail` import and rendering
- `ProtocolGrid` onSelect now calls `router.push()`
- `handleTabChange` simplified (no protocol reset needed)
- Sidebar margin wrapper in ProtocolDetailPage for standalone rendering

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

**Dynamic imports in OG generation:**
Used `await import()` for protocol registry in `generateProtocolOGImage()` to ensure side-effect registration happens at runtime.

**1-hour OG cache:**
Protocol definitions are relatively static but can be updated via file changes. 3600s cache balances freshness with CDN efficiency.

**Chain badge design:**
Followed HUB_CARDS pattern (green-bordered rounded cards) for visual consistency with existing OG images.

**ProtocolDetailPage wrapper:**
Includes `md:ml-[var(--nav-sidebar-width,60px)]` wrapper since the standalone page needs sidebar offset that the inline view inherited from parent.

**Navigation over inline detail:**
Changed hub page from inline detail view to route navigation for shareable URLs and better back/forward browser support.

## Files Changed

**Created (8 files):**
- `keeperhub/api/protocols/[slug]/route.ts` - Single protocol API
- `app/api/protocols/[slug]/route.ts` - API wrapper
- `keeperhub/app/hub/protocol/[slug]/page.tsx` - Protocol detail page
- `app/hub/protocol/[slug]/page.tsx` - Page wrapper
- `keeperhub/components/hub/protocol-detail-page.tsx` - Client navigation wrapper
- `app/api/og/protocol/[slug]/route.tsx` - OG route wrapper

**Modified (2 files):**
- `keeperhub/api/og/generate-og.tsx` - Added generateProtocolOGImage()
- `app/hub/page.tsx` - Removed inline detail, added navigation

## Verification Results

- `pnpm type-check` - PASSED
- `pnpm check` - PASSED
- All files follow keeperhub/ fork policy
- Custom code markers applied to app/ files
- No emojis, proper lint formatting

## Next Steps

- Test protocol detail pages in dev environment
- Verify OG images render correctly on social platforms
- Confirm navigation flow: hub → detail → back to hub

## Self-Check: PASSED

**Created files verified:**
```bash
[ -f "keeperhub/api/protocols/[slug]/route.ts" ] && echo "FOUND"
[ -f "app/api/protocols/[slug]/route.ts" ] && echo "FOUND"
[ -f "keeperhub/app/hub/protocol/[slug]/page.tsx" ] && echo "FOUND"
[ -f "app/hub/protocol/[slug]/page.tsx" ] && echo "FOUND"
[ -f "keeperhub/components/hub/protocol-detail-page.tsx" ] && echo "FOUND"
[ -f "app/api/og/protocol/[slug]/route.tsx" ] && echo "FOUND"
```
All files exist.

**Commits verified:**
```bash
git log --oneline | grep -E "(e69d88ece|c8818db5f)"
```
- e69d88ece - Task 1: Single-protocol API route and OG image generation
- c8818db5f - Task 2: Protocol detail page route with OG metadata

Both commits present in history.
