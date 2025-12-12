.DEFAULT_GOAL := help
.PHONY: help install dev build type-check lint fix deploy-to-local-kubernetes setup-local-kubernetes check-local-kubernetes status logs restart teardown db-create db-migrate db-studio deploy-scheduler scheduler-status scheduler-logs test test-unit test-integration test-e2e

# Development
install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

type-check:
	pnpm type-check

lint:
	pnpm lint

fix:
	pnpm fix

# Local Kubernetes Deployment
setup-local-kubernetes:
	chmod +x ./deploy/local/setup-local.sh
	./deploy/local/setup-local.sh

check-local-kubernetes:
	@chmod +x ./deploy/local/setup-local.sh
	@./deploy/local/setup-local.sh --check

deploy-to-local-kubernetes: check-local-kubernetes
	chmod +x ./deploy/local/deploy.sh
	./deploy/local/deploy.sh

deploy-to-local-kubernetes-skip-build: check-local-kubernetes
	chmod +x ./deploy/local/deploy.sh
	./deploy/local/deploy.sh --skip-build

status:
	@echo "=== Pods ==="
	@kubectl get pods -n local -l app.kubernetes.io/instance=keeperhub
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc -n local -l app.kubernetes.io/instance=keeperhub
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n local | grep keeperhub || true

logs:
	kubectl logs -n local -l app.kubernetes.io/instance=keeperhub -f

restart:
	kubectl rollout restart deployment/keeperhub-common -n local

teardown:
	helm uninstall keeperhub -n local || true
	kubectl delete ingress keeperhub-ingress -n local || true

# Database Operations
db-create:
	@echo "Creating keeperhub database..."
	kubectl exec -n local postgresql-0 -- bash -c 'PGPASSWORD=local psql -U postgres -c "CREATE DATABASE keeperhub;"' 2>/dev/null || echo "Database keeperhub already exists"
	kubectl exec -n local postgresql-0 -- bash -c 'PGPASSWORD=local psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE keeperhub TO local;"'

db-migrate:
	@echo "Running database migrations on local kubernetes..."
	@kubectl port-forward -n local svc/postgresql 5433:5432 & \
	PF_PID=$$!; \
	sleep 3; \
	DATABASE_URL="postgresql://local:local@localhost:5433/keeperhub" pnpm db:push; \
	kill $$PF_PID 2>/dev/null || true
	@echo "Migrations complete!"

db-studio:
	@echo "Starting Drizzle Studio..."
	pnpm db:studio

# Schedule Trigger Deployment
deploy-scheduler: check-local-kubernetes
	@echo "Deploying schedule trigger components..."
	kubectl apply -f ./deploy/local/schedule-trigger.yaml
	@echo ""
	@echo "Schedule trigger components deployed:"
	@echo "  - ConfigMap: scheduler-env"
	@echo "  - CronJob: schedule-dispatcher (runs every minute)"
	@echo "  - Deployment: schedule-executor (SQS consumer)"

scheduler-status:
	@echo "=== Schedule Dispatcher Jobs ==="
	@kubectl get cronjobs -n local -l component=scheduler
	@kubectl get jobs -n local -l app=schedule-dispatcher --sort-by=.metadata.creationTimestamp | tail -5
	@echo ""
	@echo "=== Schedule Executor ==="
	@kubectl get pods -n local -l app=schedule-executor
	@echo ""
	@echo "=== LocalStack (SQS) ==="
	@kubectl get pods -n local -l app=localstack

scheduler-logs:
	@echo "=== Recent Dispatcher Job Logs ==="
	@kubectl logs -n local -l app=schedule-dispatcher --tail=50 2>/dev/null || echo "No dispatcher logs available"
	@echo ""
	@echo "=== Executor Logs ==="
	@kubectl logs -n local -l app=schedule-executor --tail=100 -f

teardown-scheduler:
	kubectl delete -f ./deploy/local/schedule-trigger.yaml --ignore-not-found=true

# Testing
test:
	pnpm test

test-unit:
	pnpm test -- --run tests/unit/

test-integration:
	pnpm test -- --run tests/integration/

test-e2e:
	@echo "Running E2E tests against local kubernetes..."
	@kubectl port-forward -n local svc/postgresql 5433:5432 & PF_PID_DB=$$!; \
	kubectl port-forward -n local svc/localstack 4566:4566 & PF_PID_SQS=$$!; \
	sleep 3; \
	DATABASE_URL="postgresql://local:local@localhost:5433/keeperhub" \
	AWS_ENDPOINT_URL="http://localhost:4566" \
	SQS_QUEUE_URL="http://localhost:4566/000000000000/keeperhub-workflow-queue" \
	KEEPERHUB_URL="https://workflow.keeperhub.local" \
	pnpm test -- --run tests/e2e/; \
	kill $$PF_PID_DB 2>/dev/null || true; \
	kill $$PF_PID_SQS 2>/dev/null || true

# Help
help:
	@echo "KeeperHub Development Commands"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo ""
	@echo "  Development:"
	@echo "    install                    - Install dependencies"
	@echo "    dev                        - Start development server"
	@echo "    build                      - Build for production"
	@echo "    type-check                 - Run TypeScript type checking"
	@echo "    lint                       - Run linter"
	@echo "    fix                        - Fix linting issues"
	@echo ""
	@echo "  Local Kubernetes:"
	@echo "    setup-local-kubernetes     - Setup minikube with all infrastructure"
	@echo "    check-local-kubernetes     - Quick check if environment is ready"
	@echo "    deploy-to-local-kubernetes - Build and deploy to minikube"
	@echo "    deploy-to-local-kubernetes-skip-build - Deploy without rebuilding"
	@echo "    status                     - Show pods and services status"
	@echo "    logs                       - Follow keeperhub pod logs"
	@echo "    restart                    - Restart keeperhub deployment"
	@echo "    teardown                   - Delete keeperhub resources from cluster"
	@echo ""
	@echo "  Database:"
	@echo "    db-create                  - Create keeperhub database in PostgreSQL"
	@echo "    db-migrate                 - Run database migrations on local kubernetes"
	@echo "    db-studio                  - Open Drizzle Studio"
	@echo ""
	@echo "  Schedule Trigger:"
	@echo "    deploy-scheduler           - Deploy schedule dispatcher and executor"
	@echo "    scheduler-status           - Show scheduler pods and jobs status"
	@echo "    scheduler-logs             - Follow scheduler logs"
	@echo "    teardown-scheduler         - Remove scheduler components"
	@echo ""
	@echo "  Testing:"
	@echo "    test                       - Run all tests"
	@echo "    test-unit                  - Run unit tests"
	@echo "    test-integration           - Run integration tests"
	@echo "    test-e2e                   - Run E2E tests against local kubernetes"
