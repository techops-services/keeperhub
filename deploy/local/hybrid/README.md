# Hybrid Development Mode

Run most services in Docker Compose with only job-spawner in Minikube. This enables full workflow execution via K8s Jobs with lower resource usage.

## Why Hybrid Mode?

| Mode | Memory | Workflow Execution | Best For |
|------|--------|-------------------|----------|
| Docker Compose (`dev` profile) | ~2-3GB | Direct (no isolation) | UI/API development |
| Full Minikube | ~8GB | K8s Jobs | Production-like testing |
| **Hybrid (`minikube` profile)** | ~4-5GB | K8s Jobs | Workflow testing during dev |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Docker Compose (minikube profile)            │
├─────────────────────────────────────────────────────────────┤
│  app-dev  │  db  │  localstack  │                           │
│  (Next.js)│(Postgres)│  (SQS)  │                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ host.minikube.internal
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Minikube (minimal)                        │
├─────────────────────────────────────────────────────────────┤
│  schedule-dispatcher (CronJob)                               │
│         │                                                    │
│         ▼ SQS                                                │
│  job-spawner (Deployment) ───creates───▶ Workflow Jobs       │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

For LocalStack SQS to work correctly in hybrid mode, add the following to your `/etc/hosts`:

```bash
echo "127.0.0.1 host.minikube.internal" | sudo tee -a /etc/hosts
```

This allows both the host and Minikube pods to resolve the same SQS queue URLs.

## Quick Start

**Option 1: One-command setup**
```bash
make hybrid-setup
```

**Option 2: Step-by-step**
```bash
# 1. Start Docker Compose services
docker compose --profile minikube up -d

# 2. Run database migrations
docker compose run --rm migrator

# 3. Start Minikube with minimal resources
minikube start --memory=4096 --cpus=2

# 4. Deploy scheduler to Minikube (builds and loads images)
./deploy/local/hybrid/deploy.sh --build

# 5. Access the application
#    App: http://localhost:3000
```

## Commands

### Start Hybrid Mode

```bash
# Start Docker Compose services
docker compose --profile minikube up -d

# Build images and deploy scheduler to Minikube
./deploy/local/hybrid/deploy.sh --build
```

### Check Status

```bash
./deploy/local/hybrid/deploy.sh --status
# or
make hybrid-status
```

### Teardown

```bash
# Remove scheduler from Minikube
./deploy/local/hybrid/deploy.sh --teardown

# Stop Docker Compose services
docker compose --profile minikube down
```

### View Workflow Job Logs

```bash
# List jobs
kubectl get jobs -n local -l app=workflow-runner

# View logs for a specific job
kubectl logs -n local -l job-name=<job-name>
```

## Switching Between Modes

### From dev to minikube profile

```bash
# Stop dev profile
docker compose --profile dev down

# Start minikube profile
docker compose --profile minikube up -d

# Deploy scheduler to Minikube
./deploy/local/hybrid/deploy.sh --build
```

### From minikube back to dev profile

```bash
# Remove scheduler from Minikube
./deploy/local/hybrid/deploy.sh --teardown

# Stop minikube profile
docker compose --profile minikube down

# Start dev profile (includes dispatcher and executor in Docker)
docker compose --profile dev up -d
```

## Troubleshooting

### Job-spawner can't connect to Docker Compose services

Verify `host.minikube.internal` resolves correctly:

```bash
minikube ssh -- ping -c 3 host.minikube.internal
```

If it fails, try restarting Minikube:

```bash
minikube stop && minikube start
```

### Workflow jobs fail to run

Check job-spawner logs:

```bash
kubectl logs -n local -l app=job-spawner
```

Verify runner image is loaded:

```bash
minikube image ls | grep keeperhub-runner
```

### Database connection issues

Ensure PostgreSQL is accessible from Minikube:

```bash
minikube ssh -- nc -zv host.minikube.internal 5432
```

### SQS messages not being processed

Check LocalStack is healthy:

```bash
docker compose logs localstack
awslocal sqs list-queues
awslocal sqs get-queue-attributes --queue-url http://host.minikube.internal:4566/000000000000/keeperhub-workflow-queue --attribute-names All
```

## Files

| File | Purpose |
|------|---------|
| `setup.sh` | Full setup script (prerequisites, hosts, compose, minikube, scheduler) |
| `deploy.sh` | Deployment helper script for scheduler components |
| `init-localstack.sh` | LocalStack initialization (creates SQS queue) |
| `README.md` | This file |

## Comparison: dev vs minikube Profile

| Component | `dev` Profile | `minikube` Profile |
|-----------|--------------|-------------------|
| db | Docker Compose | Docker Compose |
| localstack | Docker Compose | Docker Compose |
| app-dev | Docker Compose | Docker Compose |
| dispatcher | Docker Compose (loop) | Minikube CronJob |
| executor | Docker Compose (direct) | - |
| job-spawner | - | Minikube Deployment |
| workflow-runner | - | Minikube Jobs |

In `dev` profile, workflows execute directly via the `executor` service (calling the API).
In `minikube` profile, workflows execute in isolated K8s Jobs created by `job-spawner`.
