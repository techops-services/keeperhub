#!/bin/bash
# =============================================================================
# Hybrid Mode Deployment Script
#
# Deploys only the scheduler components (dispatcher, job-spawner) to Minikube,
# connecting to Docker Compose services running on the host.
#
# Prerequisites:
#   - Docker Compose services running: docker compose --profile minikube up -d
#   - Minikube running: minikube start --memory=4096 --cpus=2
#
# Usage:
#   ./deploy/local/hybrid/deploy.sh [OPTIONS]
#
# Options:
#   --build       Build and load images before deploying
#   --teardown    Remove the deployment
#   --status      Show deployment status
#   --help        Show this help message
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
NAMESPACE="local"

log_info() { echo "[INFO] $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1"; }

show_help() {
    head -25 "$0" | tail -20
    exit 0
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Minikube
    if ! minikube status &>/dev/null; then
        log_error "Minikube is not running. Start it with: minikube start --memory=4096 --cpus=2"
        exit 1
    fi

    # Check Docker Compose services
    if ! docker compose --profile minikube ps --quiet 2>/dev/null | grep -q .; then
        log_warn "Docker Compose services may not be running."
        log_warn "Start them with: docker compose --profile minikube up -d"
        if [ -t 0 ]; then
            read -p "Continue anyway? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi

    # Check kubectl context
    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
    if [[ "$CURRENT_CONTEXT" != "minikube" ]]; then
        log_warn "kubectl context is '$CURRENT_CONTEXT', switching to minikube..."
        kubectl config use-context minikube
    fi

    log_info "Prerequisites OK"
}

create_namespace() {
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_info "Creating namespace '$NAMESPACE'..."
        kubectl create namespace "$NAMESPACE"
    fi
}

build_and_load_images() {
    log_info "Building images directly in Minikube's Docker daemon..."

    cd "$PROJECT_ROOT"

    # Use minikube's Docker daemon to build directly (faster than build + load)
    eval $(minikube docker-env)

    # Build executor image from submodule (schedule-executor: polls SQS, calls API)
    log_info "Building keeperhub-executor:latest in minikube..."
    docker build --target executor -t keeperhub-executor:latest ./keeperhub-scheduler

    # Reset to host Docker daemon
    eval $(minikube docker-env -u)

    log_info "Images built directly in minikube (no load needed)"
}

generate_manifest() {
    # Generate or use existing encryption key
    # For local development, we use a deterministic key; in production, this would be securely managed
    local ENCRYPTION_KEY="${INTEGRATION_ENCRYPTION_KEY:-$(openssl rand -hex 32 2>/dev/null || echo '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')}"
    local ENCRYPTION_KEY_BASE64=$(echo -n "$ENCRYPTION_KEY" | base64 -w0)

    # Source .env for consistency with docker-compose (picks up POSTGRES_DB, etc.)
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        . "$PROJECT_ROOT/.env"
        set +a
    fi

    # Support custom database name for worktrees (default: keeperhub)
    local DB_NAME="${POSTGRES_DB:-keeperhub}"

    log_info "Using encryption key (first 8 chars): ${ENCRYPTION_KEY:0:8}..."
    log_info "Using database: $DB_NAME"

    # Generate the schedule-trigger.yaml with hybrid settings
    # First part with variable expansion for the secret
    cat > "$SCRIPT_DIR/schedule-trigger-hybrid.yaml" << EOF
# Schedule Trigger Components for KeeperHub (Hybrid Mode)
# Connects to Docker Compose services via host.minikube.internal
---
# Secret for workflow runner (integration credential decryption)
apiVersion: v1
kind: Secret
metadata:
  name: keeperhub-secrets
  namespace: local
type: Opaque
data:
  integration-encryption-key: $ENCRYPTION_KEY_BASE64
EOF

    # Append the rest of the manifest (no variable expansion needed)
    cat >> "$SCRIPT_DIR/schedule-trigger-hybrid.yaml" << 'EOF'
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: scheduler-env
  namespace: local
data:
  # AWS/LocalStack - connects to Docker Compose
  AWS_ENDPOINT_URL: "http://host.minikube.internal:4566"
  AWS_REGION: "us-east-1"
  AWS_ACCESS_KEY_ID: "test"
  AWS_SECRET_ACCESS_KEY: "test"
  SQS_QUEUE_URL: "http://host.minikube.internal:4566/000000000000/keeperhub-workflow-queue"
  # Database - connects to Docker Compose PostgreSQL (port 5433 exposed on host)
  DATABASE_URL: "postgresql://postgres:postgres@host.minikube.internal:5433/__DB_NAME__"
  # KeeperHub API - connects to Docker Compose app (port 3000 exposed on host)
  KEEPERHUB_API_URL: "http://host.minikube.internal:3000"
  KEEPERHUB_API_KEY: "local-scheduler-key-for-dev"
---
# ServiceAccount for job-spawner to create K8s Jobs
apiVersion: v1
kind: ServiceAccount
metadata:
  name: job-spawner
  namespace: local
---
# Role allowing job-spawner to manage Jobs
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: job-spawner-role
  namespace: local
rules:
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["create", "get", "list", "watch", "delete"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
---
# Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: job-spawner-binding
  namespace: local
subjects:
  - kind: ServiceAccount
    name: job-spawner
    namespace: local
roleRef:
  kind: Role
  name: job-spawner-role
  apiGroup: rbac.authorization.k8s.io
---
# Job Spawner Deployment
# Long-running process that polls SQS and creates K8s Jobs for workflow execution
apiVersion: apps/v1
kind: Deployment
metadata:
  name: job-spawner
  namespace: local
  labels:
    app: job-spawner
    component: scheduler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: job-spawner
  template:
    metadata:
      labels:
        app: job-spawner
    spec:
      serviceAccountName: job-spawner
      containers:
        - name: spawner
          image: keeperhub-executor:latest
          imagePullPolicy: Never
          envFrom:
            - configMapRef:
                name: scheduler-env
          resources:
            requests:
              memory: "128Mi"
              cpu: "50m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - "pgrep -f 'schedule-executor' || exit 1"
            initialDelaySeconds: 30
            periodSeconds: 30
            failureThreshold: 3
EOF

    # Replace placeholder with actual database name
    sed -i "s/__DB_NAME__/$DB_NAME/g" "$SCRIPT_DIR/schedule-trigger-hybrid.yaml"

    log_info "Generated hybrid manifest: $SCRIPT_DIR/schedule-trigger-hybrid.yaml"
}

deploy_scheduler() {
    log_info "Deploying scheduler components to Minikube..."

    generate_manifest
    kubectl apply -f "$SCRIPT_DIR/schedule-trigger-hybrid.yaml"

    log_info "Scheduler components deployed successfully"

    # Wait for job-spawner to be ready
    log_info "Waiting for job-spawner to be ready..."
    kubectl rollout status deployment/job-spawner -n "$NAMESPACE" --timeout=120s || {
        log_warn "Job-spawner may not be fully ready yet. Check logs with: kubectl logs -n local -l app=job-spawner"
    }
}

teardown() {
    log_info "Removing hybrid deployment..."

    if [ -f "$SCRIPT_DIR/schedule-trigger-hybrid.yaml" ]; then
        kubectl delete -f "$SCRIPT_DIR/schedule-trigger-hybrid.yaml" --ignore-not-found=true
        rm -f "$SCRIPT_DIR/schedule-trigger-hybrid.yaml"
        log_info "Scheduler components removed"
    else
        # Try to delete by label/name
        kubectl delete cronjob -n "$NAMESPACE" -l component=scheduler --ignore-not-found=true
        kubectl delete deployment -n "$NAMESPACE" -l component=scheduler --ignore-not-found=true
        kubectl delete configmap -n "$NAMESPACE" scheduler-env --ignore-not-found=true
        kubectl delete secret -n "$NAMESPACE" keeperhub-secrets --ignore-not-found=true
        kubectl delete serviceaccount -n "$NAMESPACE" job-spawner --ignore-not-found=true
        kubectl delete role -n "$NAMESPACE" job-spawner-role --ignore-not-found=true
        kubectl delete rolebinding -n "$NAMESPACE" job-spawner-binding --ignore-not-found=true
        log_info "Scheduler components removed (by label)"
    fi

    # Clean up any workflow jobs
    log_info "Cleaning up workflow jobs..."
    kubectl delete jobs -n "$NAMESPACE" -l app=workflow-runner --ignore-not-found=true
}

show_status() {
    echo ""
    log_info "=== Hybrid Mode Status ==="
    echo ""

    echo "Minikube:"
    minikube status 2>/dev/null || echo "  Not running"
    echo ""

    echo "Docker Compose (minikube profile):"
    docker compose --profile minikube ps 2>/dev/null || echo "  Not running"
    echo ""

    echo "Schedule Executor (Deployment):"
    kubectl get pods -n "$NAMESPACE" -l app=job-spawner 2>/dev/null || echo "  Not found"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
    --help|-h)
        show_help
        ;;
    --build)
        check_prerequisites
        create_namespace
        build_and_load_images
        deploy_scheduler
        show_status
        ;;
    --teardown)
        teardown
        ;;
    --status)
        show_status
        ;;
    *)
        check_prerequisites
        create_namespace
        deploy_scheduler
        show_status
        ;;
esac

echo ""
log_info "=== Hybrid Mode Usage ==="
echo ""
echo "  App:          http://localhost:3000"
echo ""
echo "  Dispatcher (Docker Compose) polls for due schedules and sends to SQS."
echo "  Executor (Minikube) polls SQS and executes workflows via KeeperHub API."
echo ""
echo "  View executor logs:"
echo "    kubectl logs -n $NAMESPACE -l app=job-spawner -f"
echo ""
