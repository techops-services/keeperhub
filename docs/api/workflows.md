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
  "description": "Optional description"
}
```

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
