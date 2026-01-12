---
title: "Access Control"
description: "Understanding permissions and access control in KeeperHub organizations."
---

# Access Control

> **Roles Coming Soon**: Role-based access control is currently in development. This page describes the current state and planned functionality.

## Current Access Model

KeeperHub currently uses a simple access model where all organization members have equal permissions.

### Personal Workspace

In your personal workspace:

- Full control over all workflows you create
- Complete access to run history
- Management of notification connections
- API key generation and management

### Organization Membership

Within an organization, all members can:

- View all organization workflows
- Create new workflows
- Edit existing workflows
- Delete workflows
- Enable and disable workflows
- View run history for all workflows
- Invite new members

There is no differentiation between administrators, editors, and viewers.

## Planned Role-Based Access

Future releases will introduce role-based access control:

### Planned Roles

**Owner**
- Full administrative control
- Billing management
- Organization deletion
- Cannot be removed by others

**Admin**
- Member management (invite, remove)
- Organization settings
- All workflow permissions

**Editor**
- Create workflows
- Edit workflows
- Delete workflows
- View run history

**Viewer**
- View workflows (read-only)
- View run history
- Cannot modify workflows

### Planned Features

**Granular Permissions**
- Per-workflow access control
- Folder-based organization
- Permission inheritance

**Audit Logging**
- Track who made changes
- View permission modifications
- Export audit reports

**Approval Workflows**
- Require approval for sensitive changes
- Multi-party authorization
- Change request management

## Current Workarounds

While roles are in development:

- Create separate organizations for different access needs
- Communicate guidelines within your team
- Use workflow naming conventions to indicate ownership
- Establish internal processes for change management

## Best Practices

### For Teams

- Limit organization membership to trusted collaborators
- Document internal policies for workflow management
- Regular review of member list

### For Sensitive Workflows

- Consider separate organizations for high-security automations
- Establish review processes before enabling workflows
- Keep critical wallet operations in restricted organizations

## Security Considerations

- All organization members have equal access to shared workflows
- Workflows can execute transactions from the organization wallet
- Be cautious about who you invite to organizations with funded wallets

## Providing Feedback

If you have specific access control requirements, please contact support to share your needs.
