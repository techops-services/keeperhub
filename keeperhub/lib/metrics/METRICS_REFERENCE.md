# KeeperHub Metrics Reference

Golden signal metrics for application-level observability.

---

## Data Sources

Metrics are collected from two sources depending on the collector type:

| Source | Description | Metrics |
|--------|-------------|---------|
| **Database** | Queried from PostgreSQL on each Prometheus scrape. Required because workflow runner jobs exit before Prometheus can scrape them. | Workflow executions, steps, queue depth, concurrent count, daily active users, user stats, organization stats, workflow definitions, schedules, integrations, infrastructure |
| **API Process** | Recorded in-memory during request handling. Works normally as the API process is long-running. | Webhook latency, status polling latency, AI generation duration, plugin action duration/errors/invocations |

### Collector Behavior

| Collector | DB-sourced metrics | API-process metrics |
|-----------|-------------------|---------------------|
| **Prometheus** | Queried fresh on each `/api/metrics` scrape | Accumulated in-memory, scraped with other metrics |
| **Console** | Not emitted (would require separate cron) | Logged as structured JSON on each event |

> **Note:** DB-sourced duration metrics (workflow/step) are exposed as Prometheus gauges with `_bucket/_sum/_count` suffixes to simulate histogram semantics. Standard `histogram_quantile()` queries work, but `# TYPE` will show `gauge` instead of `histogram`.

> **Note:** All DB-sourced metrics are gauges (point-in-time snapshots). Use `max()` aggregation in multi-pod deployments. For rate/delta queries, use PromQL's `delta()` function on gauges. See "Using delta() for Rate Queries" section.

> **Note:** Runtime code (executor, routes) also increments workflow metrics for console logging, but Prometheus relies solely on DB snapshots. This dual approach ensures complete data even when workflow runners exit before scrape.

---

## Architecture Context

Understanding the user/org/wallet model helps interpret metrics correctly:

| Entity | Description | Expected Relationships |
|--------|-------------|------------------------|
| **User** | Registered or anonymous account | Each registered user auto-gets a personal org |
| **Organization** | Multi-tenant container for workflows/credentials | Each org auto-gets a Para wallet |
| **Para Wallet** | MPC wallet for blockchain signing | 1:1 with organizations |
| **Anonymous User** | Trial user without org | Can run workflows, but no chain operations |

**Key metric relationships:**
- `org.total` ≈ `para_wallet.total` (1:1 org-to-wallet)
- `user.total` ≥ `org.total` (users can share orgs via invites)
- `user.anonymous` = users without orgs (trial mode)
- Web3 steps (`transfer-funds`, `write-contract`) require org + wallet

---

## 1. LATENCY (Response Time)

Histogram metrics tracking duration/response times.

| Metric Name | Description | Labels | Target | Source |
|-------------|-------------|--------|--------|--------|
| `workflow.execution.duration_ms` | Total workflow execution time | `le` (bucket) | P95 < 2000ms | DB |
| `workflow.step.duration_ms` | Individual step execution time | `le` (bucket) | P95 < 500ms | DB |
| `api.webhook.latency_ms` | Webhook trigger response time | `status_code`, `status` | P95 < 50ms | API |
| `api.status.latency_ms` | Status polling response time | `status_code`, `status`, `execution_status` | P95 < 30ms | API |
| `plugin.action.duration_ms` | Plugin action execution time | `plugin_name`, `action_name`, `status` | P95 < 1000ms | API |
| `ai.generation.duration_ms` | AI workflow generation time | `status` | P95 < 5000ms | API |

---

## 2. TRAFFIC (Request Rate)

Counter/Gauge metrics tracking request/event counts.

| Metric Name | Description | Labels | Unit | Source |
|-------------|-------------|--------|------|--------|
| `workflow.executions.total` | Total workflow executions by status (all-time) | `status` | gauge | DB |
| `workflow.execution.errors.total` | Total failed workflow executions (all-time) | - | gauge | DB |
| `plugin.invocations.total` | Plugin action invocations | `plugin_name`, `action_name` | count | API |
| `user.active.daily` | Daily active users (24h) | - | gauge | DB |

---

## 3. ERRORS (Error Rate)

Error metrics tracking failures and exceptions.

| Metric Name | Description | Labels | Target | Source |
|-------------|-------------|--------|--------|--------|
| `workflow.execution.errors` | Failed workflow executions | - | < 5% | DB |
| `workflow.step.errors` | Failed step executions | `step_type` | < 10% | DB |
| `plugin.action.errors` | Failed plugin actions | `plugin_name`, `action_name`, `error_type` | < 20% | API |
| `api.errors.total` | API errors (webhook failures) | `endpoint`, `status_code`, `error_type` | count | API |

---

## 4. SATURATION (Resource Utilization)

Gauge metrics tracking resource usage and capacity.

| Metric Name | Description | Labels | Threshold | Source |
|-------------|-------------|--------|-----------|--------|
| `workflow.queue.depth` | Pending workflow jobs | - | < 50 | DB |
| `workflow.concurrent.count` | Concurrent workflow executions | - | gauge | DB |

---

## 5. USER & ORGANIZATION

Gauge metrics tracking user and organization statistics.

### User Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `user.total` | Total registered users | - | DB |
| `user.verified` | Users with verified email | - | DB |
| `user.anonymous` | Anonymous users | - | DB |
| `user.with_workflows` | Users who have created at least one workflow | - | DB |
| `user.with_integrations` | Users who have configured at least one integration | - | DB |
| `user.active.daily` | Daily active users (24h) | - | DB |
| `user.info` | Info gauge with one series per user | `email`, `name`, `verified` | DB |

### Organization Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `org.total` | Total organizations | - | DB |
| `org.members.total` | Total organization members across all orgs | - | DB |
| `org.members_by_role` | Organization members by role | `role` | DB |
| `org.invitations.pending` | Pending organization invitations | - | DB |
| `org.with_workflows` | Organizations with at least one workflow | - | DB |
| `org.info` | Info gauge with one series per org | `org_name`, `slug` | DB |

### Workflow Definition Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `workflow.total` | Total workflow definitions | - | DB |
| `workflow.by_visibility` | Workflows by visibility | `visibility` | DB |
| `workflow.anonymous` | Anonymous workflows | - | DB |

### Schedule Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `schedule.total` | Total workflow schedules | - | DB |
| `schedule.enabled` | Enabled workflow schedules | - | DB |
| `schedule.by_last_status` | Schedules by last run status | `status` | DB |

### Integration Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `integration.total` | Total integrations | - | DB |
| `integration.managed` | OAuth-managed integrations | - | DB |
| `integration.by_type` | Integrations by type | `type` | DB |

### Infrastructure Metrics

| Metric Name | Description | Labels | Source |
|-------------|-------------|--------|--------|
| `apikey.total` | Total API keys | - | DB |
| `chain.total` | Total blockchain networks configured | - | DB |
| `chain.enabled` | Enabled blockchain networks | - | DB |
| `para_wallet.total` | Total Para wallets | - | DB |
| `session.active` | Active (non-expired) sessions | - | DB |

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
| `status` | Execution status | `success`, `error`, `pending`, `running`, `cancelled` |
| `status_code` | HTTP status code | `200`, `400`, `500` |
| `error_type` | Classification of error | `validation`, `timeout`, `external` |
| `endpoint` | API endpoint path | `/api/workflows/webhook` |
| `service` | External service name | `discord-api`, `sendgrid-api` |
| `le` | Histogram bucket boundary | `100`, `250`, `500`, `+Inf` |
| `role` | Organization member role | `owner`, `admin`, `member` |
| `visibility` | Workflow visibility | `public`, `private` |
| `type` | Integration type | `discord`, `sendgrid`, `web3` |
| `email` | User email address (info gauge) | `user@example.com` |
| `name` | User display name (info gauge) | `John Doe` |
| `verified` | User email verified status (info gauge) | `true`, `false` |
| `org_name` | Organization name (info gauge) | `Acme Corp` |
| `slug` | Organization slug (info gauge) | `acme-corp` |

---

## Instrumentation Files

| Category | File | Functions |
|----------|------|-----------|
| Core | `keeperhub/lib/metrics/index.ts` | `getMetricsCollector()`, `createTimer()`, `withMetrics()` |
| DB Metrics | `keeperhub/lib/metrics/db-metrics.ts` | `getWorkflowStatsFromDb()`, `getStepStatsFromDb()`, `getDailyActiveUsersFromDb()`, `getUserStatsFromDb()`, `getOrgStatsFromDb()`, `getWorkflowDefinitionStatsFromDb()`, `getScheduleStatsFromDb()`, `getIntegrationStatsFromDb()`, `getInfraStatsFromDb()`, `getUserListFromDb()`, `getOrgListFromDb()` |
| API | `keeperhub/lib/metrics/instrumentation/api.ts` | `recordWebhookMetrics()`, `recordStatusPollMetrics()` |
| Plugin | `keeperhub/lib/metrics/instrumentation/plugin.ts` | `withPluginMetrics()` |

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
- `users` - total, verified, anonymous user counts; individual user info (email, name, verified)
- `workflows` - users/orgs with workflows
- `integrations` - users with integrations
- `organization` - total organization count; individual org info (name, slug)
- `member` - member counts by role
- `invitation` - pending invitation counts
- `workflow_schedules` - schedule counts, enabled status, last run status
- `api_keys` - API key count
- `chains` - blockchain network count
- `para_wallets` - Para wallet count

### Multi-Pod Aggregation (Important)

When running multiple pod replicas, all DB-sourced gauge metrics report identical values from each pod (since they query the same database). In Grafana/PromQL:

**Use `max()` instead of `sum()` for DB-sourced gauges:**

```promql
# CORRECT - returns actual count
max(keeperhub_user_total{cluster="prod", namespace="keeperhub"})

# WRONG - doubles count with 2 replicas
sum(keeperhub_user_total{cluster="prod", namespace="keeperhub"})
```

**For labeled gauges, use `max by (label)`:**

```promql
# CORRECT
max by (status) (keeperhub_workflow_executions_total{...})
max by (role) (keeperhub_org_members_by_role{...})

# WRONG
sum by (status) (keeperhub_workflow_executions_total{...})
```

**Metrics requiring `max()` aggregation:**

| Category | Metrics |
|----------|---------|
| User | `user_total`, `user_verified_total`, `user_anonymous_total`, `user_with_workflows_total`, `user_with_integrations_total`, `user_active_daily` |
| Organization | `org_total`, `org_members_total`, `org_members_by_role`, `org_invitations_pending`, `org_with_workflows_total` |
| Workflow | `workflow_total`, `workflow_by_visibility`, `workflow_anonymous_total`, `workflow_executions_total`, `workflow_execution_errors_total`, `workflow_queue_depth`, `workflow_concurrent_count` |
| Schedule | `schedule_total`, `schedule_enabled_total`, `schedule_by_last_status` |
| Integration | `integration_total`, `integration_managed_total`, `integration_by_type` |
| Infrastructure | `apikey_total`, `para_wallet_total`, `chain_total`, `chain_enabled_total`, `session_active_total` |

**Why this happens:** Each pod queries the same PostgreSQL database and reports the same gauge value. With 2 pods reporting 21 users each, `sum()` returns 42 while `max()` correctly returns 21.

**API-sourced histograms and counters** can use `sum()` since each pod accumulates independent observations from requests it handles.

---

### Using delta() for Rate Queries

For rate and change-over-time queries on DB-sourced gauges, use PromQL's `delta()` function instead of separate counter metrics. This approach is simpler and more reliable in multi-pod deployments.

**Why delta() on gauges:**
- `delta()` calculates `last_value - first_value` within the time window
- All pods report identical gauge values from DB, so `delta()` gives consistent results
- No in-memory state tracking required
- No counter reset issues on pod restarts

**PromQL examples:**

```promql
# Point-in-time snapshots (use max() for multi-pod)
max(keeperhub_workflow_executions_total{status="error"})
max(keeperhub_workflow_execution_errors_total)

# Errors added in the last hour
max(delta(keeperhub_workflow_execution_errors_total[1h]))

# Errors per minute (rate)
max(delta(keeperhub_workflow_execution_errors_total[1h])) / 60

# Executions in last 30 minutes by status
max by (status) (delta(keeperhub_workflow_executions_total[30m]))

# Error rate percentage over last hour
100 * max(delta(keeperhub_workflow_execution_errors_total[1h]))
    / clamp_min(max(delta(keeperhub_workflow_executions_total[1h])), 1)
```

**delta() vs offset:**
- `offset 1h`: Takes a single data point from 1 hour ago (may be missing)
- `delta([1h])`: Uses first and last points in range (more stable with scrape intervals)

---

### Dashboard vs Alert Time Windows

Dashboards and alerts use different time window strategies by design:

| Component | Time Window | Purpose |
|-----------|-------------|---------|
| **Dashboard stat panels** | `$__range` (user-selected) | Exploration: "What happened in this time range?" |
| **Dashboard graphs** | `$__range` or fixed window | Visualization over selected period |
| **Alerts** | Fixed windows (`[1h]`, `[5m]`) | Monitoring: "Is something wrong right now?" |

**Why they differ:**

- **Dashboards** are for exploration and investigation. When looking at an incident from 3 days ago, you'd set the time picker to that period and expect all panels to reflect that range.

- **Alerts** must evaluate consistently regardless of who's viewing what dashboard. A "high error count" alert should always check the last hour, not vary based on dashboard settings.

**Example scenarios:**

```
Dashboard time picker: "Last 6 hours"
├── Workflow Errors stat: Shows errors in last 6 hours (delta[$__range])
├── Success Rate stat: Shows rate over last 6 hours
└── Alert evaluating: Still checks last 1 hour (delta[1h] > 10)
```

**This is intentional:** The stat panel shows "156 errors in 6 hours" while the alert only fires if "errors in last 1 hour > 10". Different questions, different windows.

**Labeled gauge aggregation:**

When a gauge has labels (e.g., `step_errors_total` with `step_type`), use:
```promql
# Wrong: max() picks only the highest label value
max(keeperhub_workflow_step_errors_total{...})

# Correct: max per label, then sum for total
sum(max by (step_type) (keeperhub_workflow_step_errors_total{...}))
```

---

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
| `workflow.execution.errors.total` | `keeperhub_workflow_execution_errors_total` | gauge |
| `workflow.execution.duration_ms` | `keeperhub_workflow_execution_duration_ms_bucket` | gauge |
| `workflow.execution.duration_ms` | `keeperhub_workflow_execution_duration_ms_sum` | gauge |
| `workflow.execution.duration_ms` | `keeperhub_workflow_execution_duration_ms_count` | gauge |
| `workflow.step.executions.total` | `keeperhub_workflow_step_executions_total` | gauge |
| `workflow.step.errors` | `keeperhub_workflow_step_errors_total` | gauge |
| `workflow.step.duration_ms` | `keeperhub_workflow_step_duration_ms_bucket` | gauge |
| `workflow.step.duration_ms` | `keeperhub_workflow_step_duration_ms_sum` | gauge |
| `workflow.step.duration_ms` | `keeperhub_workflow_step_duration_ms_count` | gauge |
| `workflow.queue.depth` | `keeperhub_workflow_queue_depth` | gauge |
| `workflow.concurrent.count` | `keeperhub_workflow_concurrent_count` | gauge |
| `user.active.daily` | `keeperhub_user_active_daily` | gauge |
| `user.total` | `keeperhub_user_total` | gauge |
| `user.verified` | `keeperhub_user_verified_total` | gauge |
| `user.anonymous` | `keeperhub_user_anonymous_total` | gauge |
| `user.with_workflows` | `keeperhub_user_with_workflows_total` | gauge |
| `user.with_integrations` | `keeperhub_user_with_integrations_total` | gauge |
| `user.info` | `keeperhub_user_info` | gauge |
| `org.total` | `keeperhub_org_total` | gauge |
| `org.members.total` | `keeperhub_org_members_total` | gauge |
| `org.members_by_role` | `keeperhub_org_members_by_role` | gauge |
| `org.invitations.pending` | `keeperhub_org_invitations_pending` | gauge |
| `org.with_workflows` | `keeperhub_org_with_workflows_total` | gauge |
| `org.info` | `keeperhub_org_info` | gauge |
| `workflow.total` | `keeperhub_workflow_total` | gauge |
| `workflow.by_visibility` | `keeperhub_workflow_by_visibility` | gauge |
| `workflow.anonymous` | `keeperhub_workflow_anonymous_total` | gauge |
| `schedule.total` | `keeperhub_schedule_total` | gauge |
| `schedule.enabled` | `keeperhub_schedule_enabled_total` | gauge |
| `schedule.by_last_status` | `keeperhub_schedule_by_last_status` | gauge |
| `integration.total` | `keeperhub_integration_total` | gauge |
| `integration.managed` | `keeperhub_integration_managed_total` | gauge |
| `integration.by_type` | `keeperhub_integration_by_type` | gauge |
| `apikey.total` | `keeperhub_apikey_total` | gauge |
| `chain.total` | `keeperhub_chain_total` | gauge |
| `chain.enabled` | `keeperhub_chain_enabled_total` | gauge |
| `para_wallet.total` | `keeperhub_para_wallet_total` | gauge |
| `session.active` | `keeperhub_session_active_total` | gauge |
| `api.webhook.latency_ms` | `keeperhub_api_webhook_latency_ms` | histogram |
| `api.status.latency_ms` | `keeperhub_api_status_latency_ms` | histogram |
| `plugin.action.duration_ms` | `keeperhub_plugin_action_duration_ms` | histogram |
| `ai.generation.duration_ms` | `keeperhub_ai_generation_duration_ms` | histogram |
| `plugin.invocations.total` | `keeperhub_plugin_invocations_total` | counter |
| `plugin.action.errors` | `keeperhub_plugin_action_errors_total` | counter |
| `api.errors.total` | `keeperhub_api_errors_total` | counter |

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
