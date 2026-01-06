# Organization Implementation

## Core Requirements

1. **Authenticated users must belong to an organization** - no standalone/personal mode
2. **Registration flow** - users either create a new organization OR join an existing one via invite
3. **Multi-org support** - users can belong to multiple organizations and switch between them
4. **ParaWallet is organization-scoped** - whoever creates the wallet chooses the email (e.g., `treasury@company.com`)
5. **Anonymous users can trial the app** - they cannot join orgs, workflows are temporary/user-scoped

## User Types

| User Type | Org Required | Can Create Workflows | Can Join Org | Can Create ParaWallet |
|-----------|--------------|---------------------|--------------|----------------------|
| Anonymous | No | Yes (trial mode) | No | No |
| Authenticated | Yes | Yes (org-scoped) | Yes | Yes (if owner/admin) |

## Registration Flow

```
User registers (or links anonymous account)
     ↓
Choose: "Create Organization" or "Enter Invite Code"
     ↓                              ↓
Create org (becomes owner)    Join org (role set by inviter)
     ↓                              ↓
            → Dashboard (always in org context)
```

## Org Removal Handling

If a user is removed from their only organization:
- Redirect to "Create or Join Organization" screen
- They cannot access the main app until they belong to an org again

## Invite System

- Owners and admins can invite users
- Role is set per invite (owner, admin, or member)
- Invite via email or shareable link with code

## ParaWallet Ownership

- One wallet per organization
- Created by owner or admin
- Email is manually specified (not auto-filled from user's email)
- All org members can use the wallet for signing

## Anonymous User Flow

Anonymous users can trial the app but their workflows are discarded when they create a real account.

Rationale: Anonymous users cannot create ParaWallets, so trial workflows have no real utility in an org context.

```
Anonymous creates workflows (trial only)
     ↓
Links account → trial workflows are deleted
     ↓
Creates/joins org → starts fresh with org-scoped workflows
```
