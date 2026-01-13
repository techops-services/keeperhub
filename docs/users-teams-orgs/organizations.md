---
title: "Organizations"
description: "Create and manage organizations to collaborate on workflows with team members in KeeperHub."
---

# Organizations

Organizations allow multiple users to collaborate on workflows. All members of an organization share access to workflows created within that organization.

## Accessing Organizations

Open the "Manage Organizations" modal from the user menu to view and manage your organizations.

The modal contains two tabs:

- **Organizations**: View and manage organizations you belong to
- **Invitations**: View pending invitations from other organizations

## Creating an Organization

To create a new organization:

1. Open the Manage Organizations modal
2. Click "Create Organization"
3. Enter the required information:
   - **Organization Name**: Display name for the organization (e.g., "Acme Inc.")
   - **Slug**: URL identifier for the organization (e.g., "acme-inc")
4. Submit to create the organization

The slug is used in URLs and must be unique. It should contain only lowercase letters, numbers, and hyphens.

## Inviting Members

Organization members can invite others to join:

1. Navigate to the organization settings
2. Enter the email address of the person to invite
3. Send the invitation

The invited user will see the invitation in their Invitations tab and can accept or decline.

## Managing Invitations

In the Invitations tab:

- View all pending invitations
- Accept invitations to join organizations
- Decline invitations you do not wish to accept

When no invitations are pending, the tab displays "No pending invitations."

## Shared Workflows

Workflows created within an organization are automatically shared with all members:

- All members can view organization workflows
- All members can edit organization workflows
- All members can view run history
- All members can enable or disable workflows

## Current Limitations

### No Role-Based Access

Currently, all organization members have equal access. There are no administrator, editor, or viewer roles. All members can:

- Create new workflows
- Edit existing workflows
- Delete workflows
- Invite new members

Role-based access control is planned for a future release. See [Access Control](/docs/users-teams-orgs/permissions) for details.

### Organization Ownership

The user who creates an organization is considered the owner, but ownership transfer is not currently supported.

## Best Practices

### Naming Conventions

- Use clear, descriptive organization names
- Choose slugs that are easy to remember and type
- Consider using company or project names

### Member Management

- Only invite users who need workflow access
- Communicate with members before making significant changes
- Establish internal guidelines for workflow management

### Workflow Organization

- Use descriptive workflow names
- Include context in workflow descriptions
- Consider naming conventions for different workflow types
