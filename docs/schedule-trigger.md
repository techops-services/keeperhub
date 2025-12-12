# Schedule Trigger Implementation

This document describes the schedule trigger feature for KeeperHub, which enables workflows to run automatically on a cron schedule.

## Architecture Overview

The schedule trigger system consists of three main components:

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Dispatcher    │────▶│  SQS Queue  │────▶│    Executor      │
│   (CronJob)     │     │ (LocalStack)│     │  (Deployment)    │
└─────────────────┘     └─────────────┘     └──────────────────┘
        │                                            │
        │                                            │
        ▼                                            ▼
┌─────────────────┐                         ┌──────────────────┐
│   PostgreSQL    │                         │   KeeperHub API  │
│ (workflow_      │                         │ /api/workflow/   │
│  schedules)     │                         │ {id}/execute     │
└─────────────────┘                         └──────────────────┘
```

### Components

1. **Schedule Dispatcher** (`scripts/schedule-dispatcher.ts`)
   - Runs as a Kubernetes CronJob every minute
   - Queries `workflow_schedules` table for schedules due to run
   - Sends messages to SQS queue for each triggered schedule
   - Updates `next_run_at` and `last_run_at` timestamps

2. **Schedule Executor** (`scripts/schedule-executor.ts`)
   - Runs as a long-running Kubernetes Deployment
   - Polls SQS queue for workflow trigger messages
   - Calls KeeperHub API to execute workflows
   - Handles retries and error logging

3. **SQS Queue** (LocalStack in local dev, AWS in production)
   - Decouples dispatcher from executor
   - Provides message durability and retry capabilities
   - Queue name: `keeperhub-workflow-queue`

## Database Schema

```sql
CREATE TABLE workflow_schedules (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Local Development

### Prerequisites

- Minikube with Docker driver
- kubectl, helm, mkcert installed
- Docker daemon running

### Setup

```bash
# 1. Setup infrastructure (PostgreSQL, LocalStack, cert-manager)
make setup-local-kubernetes

# 2. Build and deploy KeeperHub
make deploy-to-local-kubernetes

# 3. Build scheduler image
docker build --target scheduler -t keeperhub-scheduler:latest .
minikube image load keeperhub-scheduler:latest

# 4. Deploy scheduler components
make deploy-scheduler
```

### Makefile Commands

| Command | Description |
|---------|-------------|
| `make deploy-scheduler` | Deploy dispatcher CronJob and executor Deployment |
| `make scheduler-status` | Show scheduler pods and job status |
| `make scheduler-logs` | Follow scheduler logs (dispatcher + executor) |
| `make teardown-scheduler` | Remove scheduler components from cluster |
| `make test-e2e` | Run E2E tests against minikube |

### Verify Deployment

```bash
# Check scheduler status
make scheduler-status

# Expected output:
# === Schedule Dispatcher Jobs ===
# NAME                  SCHEDULE    SUSPEND   ACTIVE   LAST SCHEDULE
# schedule-dispatcher   * * * * *   False     0        30s
#
# === Schedule Executor ===
# NAME                                 READY   STATUS    RESTARTS
# schedule-executor-xxx                1/1     Running   0
#
# === LocalStack (SQS) ===
# NAME                          READY   STATUS    RESTARTS
# localstack-xxx                1/1     Running   0
```

### View Logs

```bash
# Dispatcher logs (shows each minute's run)
kubectl logs -n local -l app=schedule-dispatcher --tail=50

# Executor logs (shows SQS polling and workflow triggers)
kubectl logs -n local -l app=schedule-executor -f
```

## Kubernetes Resources

### ConfigMap (`scheduler-env`)

Environment variables for scheduler components:

```yaml
AWS_ENDPOINT_URL: "http://localstack:4566"
AWS_REGION: "us-east-1"
AWS_ACCESS_KEY_ID: "test"
AWS_SECRET_ACCESS_KEY: "test"
SQS_QUEUE_URL: "http://localstack:4566/000000000000/keeperhub-workflow-queue"
KEEPERHUB_URL: "http://keeperhub-common:3000"
DATABASE_URL: "postgresql://local:local@postgresql:5432/keeperhub"
```

### CronJob (`schedule-dispatcher`)

- **Schedule**: `* * * * *` (every minute)
- **Concurrency Policy**: Forbid (prevents overlapping runs)
- **Image**: `keeperhub-scheduler:latest`

### Deployment (`schedule-executor`)

- **Replicas**: 1
- **Image**: `keeperhub-scheduler:latest`
- **Liveness Probe**: Checks for running node process

## Docker Image

The scheduler uses a separate Docker build stage:

```dockerfile
# Build scheduler image
docker build --target scheduler -t keeperhub-scheduler:latest .
```

This stage includes:
- Node.js runtime with tsx
- `scripts/` directory (dispatcher and executor)
- `lib/` directory (shared code)
- `node_modules/` (dependencies)

## Testing

### Unit Tests

```bash
pnpm test -- --run tests/unit/schedule-dispatcher.test.ts
pnpm test -- --run tests/unit/schedule-executor.test.ts
```

### Integration Tests

```bash
pnpm test -- --run tests/integration/
```

### E2E Tests (against minikube)

```bash
make test-e2e
```

E2E tests verify:
- PostgreSQL connectivity
- LocalStack SQS connectivity
- Database schema (workflow_schedules table)
- SQS message send/receive

## Production Considerations

### AWS SQS Setup

1. Create SQS queue: `keeperhub-workflow-queue`
2. Configure dead-letter queue for failed messages
3. Set appropriate visibility timeout (30 seconds recommended)
4. Configure IAM permissions for dispatcher/executor

### Environment Variables (Production)

```yaml
AWS_REGION: "us-east-1"  # Your region
SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789/keeperhub-workflow-queue"
KEEPERHUB_URL: "https://workflow.keeperhub.com"
DATABASE_URL: "postgresql://user:pass@host:5432/keeperhub"
# Remove AWS_ENDPOINT_URL in production (uses real AWS)
```

### Scaling

- **Dispatcher**: Single instance (CronJob with Forbid policy)
- **Executor**: Can scale horizontally (multiple replicas polling same queue)

### Monitoring

- Monitor SQS queue depth for backlog
- Alert on executor pod restarts
- Track workflow execution latency
- Monitor dispatcher job failures

## Troubleshooting

### Dispatcher not running

```bash
# Check CronJob status
kubectl get cronjobs -n local

# Check recent jobs
kubectl get jobs -n local -l app=schedule-dispatcher

# Check job logs
kubectl logs -n local -l app=schedule-dispatcher --tail=100
```

### Executor not processing messages

```bash
# Check executor pod
kubectl get pods -n local -l app=schedule-executor

# Check logs
kubectl logs -n local -l app=schedule-executor -f

# Verify SQS queue has messages
kubectl exec -n local deploy/localstack -- awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/keeperhub-workflow-queue \
  --attribute-names ApproximateNumberOfMessages
```

### Image pull errors

```bash
# Verify image is loaded in minikube
minikube image list | grep keeperhub-scheduler

# Reload if missing
docker build --target scheduler -t keeperhub-scheduler:latest .
minikube image load keeperhub-scheduler:latest
```

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/schedule-dispatcher.ts` | Dispatcher script (queries DB, sends to SQS) |
| `scripts/schedule-executor.ts` | Executor script (polls SQS, triggers workflows) |
| `lib/schedule-service.ts` | Schedule management service |
| `lib/db/schema/workflow-schedules.ts` | Database schema |
| `deploy/local/schedule-trigger.yaml` | K8s manifests for scheduler |
| `deploy/local/setup-local.sh` | Local infrastructure setup |
| `tests/unit/schedule-*.test.ts` | Unit tests |
| `tests/e2e/schedule-pipeline.test.ts` | E2E tests |
