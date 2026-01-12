---
title: "Executions API"
description: "KeeperHub Executions API - monitor workflow execution status and retrieve logs."
---

# Executions API

Monitor and manage workflow executions.

## List Executions

```http
GET /api/workflows/{workflowId}/executions
```

Returns execution history for a workflow.

### Response

```json
{
  "data": [
    {
      "id": "exec_123",
      "workflowId": "wf_456",
      "status": "success",
      "input": {...},
      "output": {...},
      "createdAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:00:05Z"
    }
  ]
}
```

## Get Execution Status

```http
GET /api/workflows/executions/{executionId}/status
```

Returns real-time execution status with progress tracking.

### Response

```json
{
  "status": "running",
  "nodeStatuses": [
    { "nodeId": "node_1", "status": "success" },
    { "nodeId": "node_2", "status": "running" }
  ],
  "progress": {
    "totalSteps": 3,
    "completedSteps": 1,
    "runningSteps": 1,
    "currentNodeId": "node_2",
    "percentage": 33
  }
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `pending` | Execution queued |
| `running` | Currently executing |
| `success` | Completed successfully |
| `error` | Failed with error |
| `cancelled` | Manually cancelled |

## Get Execution Logs

```http
GET /api/workflows/executions/{executionId}/logs
```

Returns detailed logs for each node in the execution.

### Response

```json
{
  "data": [
    {
      "nodeId": "node_1",
      "nodeName": "Check Balance",
      "nodeType": "trigger",
      "status": "success",
      "input": {...},
      "output": {...},
      "duration": 1234,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Delete Executions

```http
DELETE /api/workflows/{workflowId}/executions
```

Bulk delete execution history for a workflow.
