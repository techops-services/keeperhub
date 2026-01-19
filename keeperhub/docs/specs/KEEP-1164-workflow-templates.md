# KEEP-1164: Workflow Templates Feature

## Overview

Add a curated templates system for workflows created and managed by the KeeperHub internal team. Templates are distinct from user-shared public workflows - they have richer metadata and are promoted via an internal admin endpoint.

## User Flow

1. User visits Hub page
2. Templates section displays curated workflows with images, descriptions, categories
3. User clicks "Use Template"
4. Existing duplicate flow creates a private copy in their organization
5. User configures their own integrations and customizes the workflow

## Database Changes

Add 4 fields to the `workflows` table in `lib/db/schema.ts`:

```typescript
// start custom keeperhub code //
isTemplate: boolean("is_template").default(false).notNull(),
templateImage: text("template_image"),
templateCategory: text("template_category"),
templateOrder: integer("template_order").default(0),
// end keeperhub code //
```

| Field | Type | Description |
|-------|------|-------------|
| `isTemplate` | boolean | Flag that marks workflow as a template (the "featured" flag) |
| `templateImage` | text | URL to template thumbnail/preview image |
| `templateCategory` | text | Optional category for grouping (e.g., "Web3", "Notifications") |
| `templateOrder` | integer | Sort priority (higher = appears first) |

Note: `description` already exists on the workflow table.

## API Changes

### 1. Admin Endpoint: Promote/Update Template

**Route:** `POST /keeperhub/api/admin/templates`

**Authentication:** Internal service key via `X-Service-Key` header

**Environment Variable:** `ADMIN_SERVICE_API_KEY`

**Request Body:**
```typescript
{
  workflowId: string;          // Required - workflow to promote
  isTemplate?: boolean;        // Default: true (set false to demote)
  templateImage?: string;      // Image URL
  templateCategory?: string;   // Category name
  templateOrder?: number;      // Sort priority
}
```

**Response:**
```typescript
{
  success: true;
  workflow: {
    id: string;
    name: string;
    isTemplate: boolean;
    templateImage: string | null;
    templateCategory: string | null;
    templateOrder: number;
  }
}
```

**Usage:**
```bash
curl -X POST https://app.keeperhub.com/api/admin/templates \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: $ADMIN_SERVICE_API_KEY" \
  -d '{
    "workflowId": "abc123",
    "templateImage": "https://...",
    "templateCategory": "Web3",
    "templateOrder": 10
  }'
```

### 2. Update Public Workflows Endpoint

**Route:** `GET /api/workflows/public`

**New Query Parameter:** `templates=true`

**Behavior:**
- `?templates=true` - Returns only workflows where `isTemplate = true`, ordered by `templateOrder DESC, updatedAt DESC`
- No parameter or `templates=false` - Returns public workflows where `isTemplate = false` (existing behavior)

**Response Addition:**
```typescript
{
  // Existing fields...
  isTemplate: boolean;
  templateImage: string | null;
  templateCategory: string | null;
  templateOrder: number;
}
```

## Frontend Changes

### Hub Page Updates

Location: `app/hub/page.tsx` and `keeperhub/components/hub/workflow-template-grid.tsx`

1. Fetch templates via `/api/workflows/public?templates=true`
2. Display templates section with:
   - Template image (if available, fallback to placeholder)
   - Name and description
   - Category badge (if set)
3. Sort by `templateOrder` (already handled by API)
4. Keep existing "Use Template" button and duplicate flow

### Template Card Component

Create or update card to display:
- Thumbnail image (aspect ratio ~16:9 or 4:3)
- Template name
- Description (line-clamp-2)
- Category badge (optional)
- "Use Template" action button

## File Locations

Following KeeperHub custom code policy:

| Change | Location |
|--------|----------|
| Schema fields | `lib/db/schema.ts` (within markers) |
| Admin endpoint | `keeperhub/api/admin/templates/route.ts` |
| Service auth update | `keeperhub/lib/internal-service-auth.ts` |
| Public API filter | `app/api/workflows/public/route.ts` (within markers) |
| Hub UI updates | `keeperhub/components/hub/workflow-template-grid.tsx` |

## Implementation Steps

1. Add schema fields to `lib/db/schema.ts`
2. Run `pnpm db:push` to apply migration
3. Add `admin` to allowed services in `internal-service-auth.ts`
4. Create admin endpoint at `keeperhub/api/admin/templates/route.ts`
5. Update `/api/workflows/public` to support `?templates=true` filter
6. Update Hub UI to fetch and display templates
7. Add `ADMIN_SERVICE_API_KEY` to environment variables

## Environment Variables

```
ADMIN_SERVICE_API_KEY=<generate-secure-key>
```

## Security Considerations

- Admin endpoint protected by service key (not exposed to users)
- Templates inherit existing public workflow sanitization (integration IDs stripped)
- Duplicate flow already handles safe copying

## Out of Scope

- Template versioning
- Admin UI for managing templates
- Template analytics/usage tracking
