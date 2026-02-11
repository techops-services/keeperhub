---
title: "Workflows API"
description: "KeeperHub Workflows API - create, read, update, delete, and execute workflows."
---

# Workflows API

Manage workflows programmatically.

## List Workflows

```http
GET /api/workflows
```

Returns all workflows for the authenticated user.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Optional. Filter workflows by project ID |

### Example

```http
GET /api/workflows?projectId=proj_123
```

### Response

```json
{
  "data": [
    {
      "id": "wf_123",
      "name": "My Workflow",
      "description": "Monitors ETH balance",
      "visibility": "private",
      "nodes": [...],
      "edges": [...],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Get Workflow

```http
GET /api/workflows/{workflowId}
```

Returns a single workflow by ID.

## Create Workflow

```http
POST /api/workflows
```

### Request Body

```json
{
  "name": "New Workflow",
  "description": "Optional description",
  "projectId": "proj_123"
}
```

The `projectId` field is optional. If provided, the workflow is assigned to the specified [project](/api/projects).

### Response

Returns the created workflow with a default trigger node.

## Update Workflow

```http
PATCH /api/workflows/{workflowId}
```

### Request Body

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "projectId": "proj_123",
  "nodes": [...],
  "edges": [...],
  "visibility": "private"
}
```

## Delete Workflow

```http
DELETE /api/workflows/{workflowId}
```

## Execute Workflow

```http
POST /api/workflow/{workflowId}/execute
```

Manually trigger a workflow execution.

### Response

```json
{
  "executionId": "exec_123",
  "status": "pending"
}
```

## Webhook Trigger

```http
POST /api/workflows/{workflowId}/webhook
```

Trigger a workflow via webhook. Requires API key authentication.

## Duplicate Workflow

```http
POST /api/workflows/{workflowId}/duplicate
```

Creates a copy of an existing workflow.

## Download Workflow

```http
GET /api/workflows/{workflowId}/download
```

Download workflow definition as JSON.

## Generate Code

```http
GET /api/workflows/{workflowId}/code
```

Generate SDK code for the workflow.

## Claim Workflow

```http
POST /api/workflows/{workflowId}/claim
```

Claim an anonymous workflow into the authenticated user's organization. Only the original creator of the anonymous workflow can claim it.

## Workflow Taxonomy

```http
GET /api/workflows/taxonomy
```

Returns distinct categories and protocols from all public workflows. Useful for building filter UIs.

### Response

```json
{
  "categories": ["defi", "nft"],
  "protocols": ["uniswap", "aave"]
}
```

## Update Featured Status (Internal)

```http
POST /api/hub/featured
```

Mark a workflow as featured in the hub. Requires internal service authentication (`hub` service). Accepts optional `category`, `protocol`, and `featuredOrder` fields alongside the `workflowId`.
