# KeeperHub Metrics Reference

Golden signal metrics for application-level observability.

---

## Data Sources

Metrics are collected from two sources:

| Source | Description | Metrics |
|--------|-------------|---------|
| **Database** | Queried from PostgreSQL on each Prometheus scrape. Required because workflow runner jobs exit before Prometheus can scrape them. | Workflow executions, steps, queue depth, concurrent count, daily active users |
| **API Process** | Recorded in-memory during request handling. Works normally as the API process is long-running. | API latency, webhook latency, AI generation, plugin actions |

---

## 1. LATENCY (Response Time)

Histogram metrics tracking duration/response times.

| Metric Name | Description | Labels | Target | Source |
|-------------|-------------|--------|--------|--------|
| `workflow.execution.duration_ms` | Total workflow execution time | `le` (bucket) | P95 < 2000ms | DB |
| `workflow.step.duration_ms` | Individual step execution time | `le` (bucket) | P95 < 500ms | DB |
| `api.webhook.latency_ms` | Webhook trigger response time | `workflow_id`, `status`, `status_code` | P95 < 50ms | API |
| `api.status.latency_ms` | Status polling response time | `execution_id`, `status` | P95 < 30ms | API |
| `plugin.action.duration_ms` | Plugin action execution time | `plugin_name`, `action_name`, `execution_id`, `status` | P95 < 1000ms | API |
| `ai.generation.duration_ms` | AI workflow generation time | `status` | P95 < 5000ms | API |

---

## 2. TRAFFIC (Request Rate)

Counter/Gauge metrics tracking request/event counts.

| Metric Name | Description | Labels | Unit | Source |
|-------------|-------------|--------|------|--------|
| `workflow.executions.total` | Total workflow executions | `status` | gauge | DB |
| `api.requests.total` | Total API requests | `endpoint`, `status_code` | count | API |
| `plugin.invocations.total` | Plugin action invocations | `plugin_name`, `action_name` | count | API |
| `user.active.daily` | Daily active users (24h) | - | gauge | DB |
| `ai.tokens.consumed` | AI token consumption | - | count | API |

---

## 3. ERRORS (Error Rate)

Error metrics tracking failures and exceptions.

| Metric Name | Description | Labels | Target | Source |
|-------------|-------------|--------|--------|--------|
| `workflow.execution.errors` | Failed workflow executions | - | < 5% | DB |
| `workflow.step.errors` | Failed step executions | `step_type` | < 10% | DB |
| `plugin.action.errors` | Failed plugin actions | `plugin_name`, `action_name`, `error_type` | < 20% | API |
| `api.errors.total` | API errors by status code | `endpoint`, `status_code`, `error_type` | count | API |
| `external.service.errors` | External service failures | `service`, `plugin_name` | count | API |

---

## 4. SATURATION (Resource Utilization)

Gauge metrics tracking resource usage and capacity.

| Metric Name | Description | Labels | Threshold | Source |
|-------------|-------------|--------|-----------|--------|
| `db.pool.utilization` | Database connection pool usage (%) | `active`, `max` | < 80% | API |
| `db.query.slow_count` | Slow queries (>100ms) | `threshold`, `query_type` | < 10/min | API |
| `workflow.queue.depth` | Pending workflow jobs | - | < 50 | DB |
| `workflow.concurrent.count` | Concurrent workflow executions | - | gauge | DB |

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
| `status` | Execution status | `success`, `error`, `pending`, `running` |
| `status_code` | HTTP status code | `200`, `400`, `500` |
| `error_type` | Classification of error | `validation`, `timeout`, `external` |
| `endpoint` | API endpoint path | `/api/workflows/webhook` |
| `service` | External service name | `discord-api`, `sendgrid-api` |
| `le` | Histogram bucket boundary | `100`, `250`, `500`, `+Inf` |

---

## Instrumentation Files

| Category | File | Functions |
|----------|------|-----------|
| Core | `keeperhub/lib/metrics/index.ts` | `getMetricsCollector()`, `createTimer()`, `withMetrics()` |
| DB Metrics | `keeperhub/lib/metrics/db-metrics.ts` | `getWorkflowStatsFromDb()`, `getStepStatsFromDb()`, `getDailyActiveUsersFromDb()` |
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

### DB-Sourced Metrics

Before returning metrics, the endpoint queries the database to populate workflow/step metrics. This is necessary because workflow runner jobs (Kubernetes Jobs) exit before Prometheus can scrape them.

The following tables are queried:
- `workflow_executions` - execution counts by status, duration histogram
- `workflow_execution_logs` - step counts by type/status, step duration histogram
- `sessions` - daily active users (distinct users with sessions updated in 24h)

### ServiceMonitor (Prometheus Operator)

Prometheus scraping is configured via the Helm chart's built-in ServiceMonitor support in values.yaml:

```yaml
serviceMonitors:
  enabled: true
  monitors:
    - name: metrics
      port: http
      path: /api/metrics
      interval: 30s
      scrapeTimeout: 10s
```

### Prometheus Metric Names

Prometheus metrics are prefixed with `keeperhub_` and use snake_case:

| Original Name | Prometheus Name | Type |
|---------------|-----------------|------|
| `workflow.executions.total` | `keeperhub_workflow_executions_total` | gauge |
| `workflow.execution.errors` | `keeperhub_workflow_execution_errors_total` | gauge |
| `workflow.execution.duration_ms` | `keeperhub_workflow_execution_duration_ms_bucket` | gauge |
| `workflow.step.executions.total` | `keeperhub_workflow_step_executions_total` | gauge |
| `workflow.step.errors` | `keeperhub_workflow_step_errors_total` | gauge |
| `workflow.step.duration_ms` | `keeperhub_workflow_step_duration_ms_bucket` | gauge |
| `workflow.queue.depth` | `keeperhub_workflow_queue_depth` | gauge |
| `workflow.concurrent.count` | `keeperhub_workflow_concurrent_count` | gauge |
| `user.active.daily` | `keeperhub_user_active_daily` | gauge |
| `api.webhook.latency_ms` | `keeperhub_api_webhook_latency_ms` | histogram |
| `api.requests.total` | `keeperhub_api_requests_total` | counter |
| `plugin.action.errors` | `keeperhub_plugin_action_errors_total` | counter |

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
