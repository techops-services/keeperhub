# KeeperHub Metrics Reference

Golden signal metrics for application-level observability.

---

## 1. LATENCY (Response Time)

Histogram metrics tracking duration/response times.

| Metric Name | Description | Labels | Target |
|-------------|-------------|--------|--------|
| `workflow.execution.duration_ms` | Total workflow execution time | `workflow_id`, `execution_id`, `trigger_type`, `status` | P95 < 2000ms |
| `workflow.step.duration_ms` | Individual step execution time | `execution_id`, `step_type`, `status` | P95 < 500ms |
| `api.webhook.latency_ms` | Webhook trigger response time | `workflow_id`, `status`, `status_code` | P95 < 50ms |
| `api.status.latency_ms` | Status polling response time | `execution_id`, `status` | P95 < 30ms |
| `plugin.action.duration_ms` | Plugin action execution time | `plugin_name`, `action_name`, `execution_id`, `status` | P95 < 1000ms |
| `ai.generation.duration_ms` | AI workflow generation time | `status` | P95 < 5000ms |

---

## 2. TRAFFIC (Request Rate)

Counter metrics tracking request/event counts.

| Metric Name | Description | Labels | Unit |
|-------------|-------------|--------|------|
| `workflow.executions.total` | Total workflow executions | `trigger_type`, `workflow_id` | count |
| `api.requests.total` | Total API requests | `endpoint`, `status_code` | count |
| `plugin.invocations.total` | Plugin action invocations | `plugin_name`, `action_name`, `execution_id` | count |
| `user.active.daily` | Daily active users | - | gauge |
| `ai.tokens.consumed` | AI token consumption | - | count |

---

## 3. ERRORS (Error Rate)

Error metrics tracking failures and exceptions.

| Metric Name | Description | Labels | Target |
|-------------|-------------|--------|--------|
| `workflow.execution.errors` | Failed workflow executions | `workflow_id`, `execution_id`, `trigger_type`, `error_type` | < 5% |
| `workflow.step.errors` | Failed step executions | `execution_id`, `step_type`, `error_type` | < 10% |
| `plugin.action.errors` | Failed plugin actions | `plugin_name`, `action_name`, `execution_id` | < 20% |
| `api.errors.total` | API errors by status code | `endpoint`, `status_code`, `error_type` | count |
| `external.service.errors` | External service failures | `service`, `plugin_name`, `status_code` | count |

---

## 4. SATURATION (Resource Utilization)

Gauge metrics tracking resource usage and capacity.

| Metric Name | Description | Labels | Threshold |
|-------------|-------------|--------|-----------|
| `db.pool.utilization` | Database connection pool usage (%) | `active`, `max` | < 80% |
| `db.query.slow_count` | Slow queries (>100ms) | `threshold`, `query_type` | < 10/min |
| `workflow.queue.depth` | Pending workflow jobs | - | < 50 |
| `workflow.concurrent.count` | Concurrent workflow executions | - | gauge |

---

## Label Keys Reference

| Label Key | Description | Example Values |
|-----------|-------------|----------------|
| `workflow_id` | Unique workflow identifier | `wf_abc123` |
| `execution_id` | Unique execution identifier | `exec_xyz789` |
| `step_type` | Type of workflow step/action | `send-message`, `http-request` |
| `plugin_name` | Plugin name | `discord`, `sendgrid`, `web3` |
| `action_name` | Action name within plugin | `send-message`, `send-email` |
| `trigger_type` | How workflow was triggered | `manual`, `webhook`, `scheduled` |
| `status` | Execution status | `success`, `failure` |
| `status_code` | HTTP status code | `200`, `400`, `500` |
| `error_type` | Classification of error | `validation`, `timeout`, `external` |
| `endpoint` | API endpoint path | `/api/workflows/webhook` |
| `service` | External service name | `discord-api`, `sendgrid-api` |

---

## Instrumentation Files

| Category | File | Functions |
|----------|------|-----------|
| Core | `keeperhub/lib/metrics/index.ts` | `getMetricsCollector()`, `createTimer()`, `withMetrics()` |
| Workflow | `keeperhub/lib/metrics/instrumentation/workflow.ts` | `recordWorkflowComplete()`, `recordStepMetrics()` |
| API | `keeperhub/lib/metrics/instrumentation/api.ts` | `recordWebhookMetrics()`, `recordStatusPollMetrics()` |
| Plugin | `keeperhub/lib/metrics/instrumentation/plugin.ts` | `withPluginMetrics()`, `recordExternalServiceCall()` |
| Saturation | `keeperhub/lib/metrics/instrumentation/saturation.ts` | `withConcurrentTracking()`, `recordDbPoolUtilization()` |

---

## Collectors

Metrics can be exported via different collectors based on `METRICS_COLLECTOR` env var:

| Collector | Environment Variable | Description |
|-----------|---------------------|-------------|
| Console (default) | `METRICS_COLLECTOR=console` | Structured JSON logs (CloudWatch/Datadog compatible) |
| Prometheus | `METRICS_COLLECTOR=prometheus` | Exposes `/api/metrics` endpoint for Prometheus scraping |
| Noop | `METRICS_COLLECTOR=noop` | Silent collector (for testing) |

---

## Prometheus Configuration

When using Prometheus collector, metrics are exposed at `/api/metrics` in Prometheus text format.

### Kubernetes Pod Annotations

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/api/metrics"
```

### Prometheus Metric Names

Prometheus metrics are prefixed with `keeperhub_` and use snake_case:

| Original Name | Prometheus Name |
|---------------|-----------------|
| `workflow.execution.duration_ms` | `keeperhub_workflow_execution_duration_ms` |
| `workflow.executions.total` | `keeperhub_workflow_executions_total` |
| `plugin.action.errors` | `keeperhub_plugin_action_errors_total` |
| `workflow.concurrent.count` | `keeperhub_workflow_concurrent_count` |

### Default Node.js Metrics

When Prometheus collector is enabled, default Node.js metrics are also collected:
- `keeperhub_nodejs_heap_size_total_bytes`
- `keeperhub_nodejs_heap_size_used_bytes`
- `keeperhub_nodejs_external_memory_bytes`
- `keeperhub_nodejs_active_handles_total`
- `keeperhub_nodejs_active_requests_total`
- `keeperhub_nodejs_eventloop_lag_seconds`
- `keeperhub_process_cpu_*`
- `keeperhub_process_resident_memory_bytes`

---

## Structured Log Format (Console Collector)

When using console collector, metrics are emitted as structured JSON (CloudWatch/Datadog compatible):

```json
{
  "timestamp": "2024-01-13T10:30:00.000Z",
  "level": "info",
  "metric": {
    "name": "workflow.execution.duration_ms",
    "type": "histogram",
    "value": 1234,
    "labels": {
      "workflow_id": "wf_123",
      "trigger_type": "webhook",
      "status": "success"
    }
  }
}
```
