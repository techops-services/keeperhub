---
title: "Error Codes"
description: "KeeperHub API error codes and troubleshooting guide."
---

# Error Codes

Reference for API error codes and how to resolve them.

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description"
  }
}
```

## HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Common Error Codes

### Authentication Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `UNAUTHORIZED` | Missing authentication | Include valid session or API key |
| `INVALID_API_KEY` | API key is invalid or revoked | Generate a new API key |
| `SESSION_EXPIRED` | Session has expired | Re-authenticate |

### Validation Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_INPUT` | Request body validation failed | Check required fields |
| `INVALID_ADDRESS` | Invalid Ethereum address | Verify address format |
| `INVALID_CHAIN_ID` | Unsupported chain ID | Use supported chain |

### Resource Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `NOT_FOUND` | Resource does not exist | Verify resource ID |
| `ALREADY_EXISTS` | Resource already exists | Use update instead |
| `PERMISSION_DENIED` | No access to resource | Verify ownership |

### Execution Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `EXECUTION_FAILED` | Workflow execution failed | Check execution logs |
| `INSUFFICIENT_FUNDS` | Wallet lacks funds for gas | Top up Para wallet |
| `GAS_LIMIT_EXCEEDED` | Transaction exceeded gas limit | Increase gas limit |
| `CONTRACT_ERROR` | Smart contract reverted | Check contract state |

### Rate Limiting

| Code | Description | Resolution |
|------|-------------|------------|
| `RATE_LIMITED` | Too many requests | Wait and retry |

## Retry Strategy

For transient errors (5xx, rate limits), use exponential backoff:

```
Wait time = min(base * 2^attempt, max_wait)
```

Recommended:
- Base: 1 second
- Max attempts: 5
- Max wait: 30 seconds
