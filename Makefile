.DEFAULT_GOAL := help
.PHONY: help install dev build type-check lint fix deploy-to-local-kubernetes setup-local-kubernetes check-local-kubernetes status logs restart teardown db-create db-migrate db-studio build-scheduler-images deploy-scheduler scheduler-status scheduler-logs runner-logs teardown-scheduler test test-unit test-integration test-e2e test-e2e-hybrid hybrid-setup hybrid-up hybrid-deploy hybrid-deploy-only hybrid-status hybrid-down hybrid-reset hybrid-logs hybrid-executor-logs dev-setup dev-up dev-down dev-logs dev-migrate

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
build-scheduler-images:
	@echo "Building dispatcher image from submodule..."
	docker build --target dispatcher -t keeperhub-dispatcher:latest ./keeperhub-scheduler
	@echo "Building executor image from submodule..."
	docker build --target executor -t keeperhub-executor:latest ./keeperhub-scheduler
	@echo "Loading images into minikube..."
	minikube image load keeperhub-dispatcher:latest
	minikube image load keeperhub-executor:latest
	@echo "Images ready!"

deploy-scheduler: check-local-kubernetes
	@echo "Deploying schedule trigger components..."
	kubectl apply -f ./deploy/local/schedule-trigger.yaml
	@echo ""
	@echo "Schedule trigger components deployed:"
	@echo "  - ConfigMap: scheduler-env"
	@echo "  - RBAC: ServiceAccount, Role, RoleBinding for job-spawner"
	@echo "  - CronJob: schedule-dispatcher (runs every minute)"
	@echo "  - Deployment: job-spawner (polls SQS, creates K8s Jobs)"

scheduler-status:
	@echo "=== Schedule Dispatcher Jobs ==="
	@kubectl get cronjobs -n local -l component=scheduler
	@kubectl get jobs -n local -l app=schedule-dispatcher --sort-by=.metadata.creationTimestamp | tail -5
	@echo ""
	@echo "=== Job Spawner ==="
	@kubectl get pods -n local -l app=job-spawner
	@echo ""
	@echo "=== Workflow Runner Jobs ==="
	@kubectl get jobs -n local -l app=workflow-runner --sort-by=.metadata.creationTimestamp | tail -10 || echo "No workflow jobs"
	@echo ""
	@echo "=== LocalStack (SQS) ==="
	@kubectl get pods -n local -l app=localstack

scheduler-logs:
	@echo "=== Recent Dispatcher Job Logs ==="
	@kubectl logs -n local -l app=schedule-dispatcher --tail=50 2>/dev/null || echo "No dispatcher logs available"
	@echo ""
	@echo "=== Job Spawner Logs ==="
	@kubectl logs -n local -l app=job-spawner --tail=100 -f

runner-logs:
	@echo "=== Recent Workflow Runner Job Logs ==="
	@kubectl logs -n local -l app=workflow-runner --tail=100 2>/dev/null || echo "No runner logs available"

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
	KEEPERHUB_API_URL="https://workflow.keeperhub.local" \
	pnpm test -- --run tests/e2e/; \
	kill $$PF_PID_DB 2>/dev/null || true; \
	kill $$PF_PID_SQS 2>/dev/null || true

test-e2e-hybrid:
	@echo "Running E2E tests against hybrid deployment (Docker Compose + Minikube)..."
	@echo "Checking services are running..."
	@docker compose ps --format '{{.Service}} {{.State}}' | grep -q "db running" || (echo "Error: Database not running. Run 'make hybrid-up' first." && exit 1)
	@docker compose ps --format '{{.Service}} {{.State}}' | grep -q "localstack running" || (echo "Error: LocalStack not running. Run 'make hybrid-up' first." && exit 1)
	@echo "Services OK. Running tests..."
	DATABASE_URL="postgresql://postgres:postgres@localhost:5433/keeperhub" \
	AWS_ENDPOINT_URL="http://localhost:4566" \
	SQS_QUEUE_URL="http://localhost:4566/000000000000/keeperhub-workflow-queue" \
	pnpm test -- --run tests/e2e/

# =============================================================================
# Docker Compose - Dev Profile (No K8s Jobs)
# =============================================================================

dev-up:
	@echo "Starting dev profile..."
	docker compose --profile dev up -d
	@echo ""
	@echo "Services started:"
	@echo "  - db (PostgreSQL)"
	@echo "  - localstack (SQS)"
	@echo "  - redis (caching + event sync)"
	@echo "  - app-dev (KeeperHub)"
	@echo "  - dispatcher (schedule polling)"
	@echo "  - sc-event-worker (blockchain event dispatch)"
	@echo "  - sc-event-tracker (blockchain event monitoring)"
	@echo ""
	@echo "Note: Scheduled workflow execution requires hybrid mode (make hybrid-deploy)"
	@echo ""
	@echo "App: http://localhost:3000"

dev-down:
	docker compose --profile dev down

dev-logs:
	docker compose --profile dev logs -f

dev-migrate:
	docker compose --profile dev --profile migrator run --rm migrator

dev-setup:
	@echo "Setting up dev environment (first time)..."
	docker compose --profile dev up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Running database migrations..."
	docker compose --profile dev --profile migrator run --rm migrator
	@echo ""
	@echo "Dev environment ready!"
	@echo "  App: http://localhost:3000"
	@echo ""
	@echo "For subsequent starts, use: make dev-up"

# =============================================================================
# Hybrid Mode (Docker Compose + Minikube for schedule execution)
# =============================================================================

hybrid-setup:
	# Full setup: prerequisites, /etc/hosts, Docker Compose, Minikube, executor
	chmod +x ./deploy/local/hybrid/setup.sh
	./deploy/local/hybrid/setup.sh

hybrid-up:
	# Start Docker Compose services (everything except executor)
	docker compose --profile minikube up -d
	@echo "Docker Compose services started. Now deploy executor to Minikube:"
	@echo "  make hybrid-deploy"

hybrid-deploy:
	# Start Docker Compose services and deploy executor to Minikube
	@echo "Starting Docker Compose services..."
	docker compose --profile minikube up -d
	# Wait for database to be ready
	@echo "Waiting for database to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then \
			echo "Database is ready!"; \
			break; \
		fi; \
		if [ $$i -eq 10 ]; then \
			echo "Error: Database not ready after 10 attempts."; \
			exit 1; \
		fi; \
		echo "Waiting for database... (attempt $$i/10)"; \
		sleep 2; \
	done
	# Run database migrations and seed chains
	@echo "Setting up database schema and seeding chains..."
	@DATABASE_URL="postgresql://postgres:postgres@localhost:5433/$${POSTGRES_DB:-keeperhub}" pnpm db:push || echo "Schema push completed (or already up to date)"
	@DATABASE_URL="postgresql://postgres:postgres@localhost:5433/$${POSTGRES_DB:-keeperhub}" npx tsx scripts/seed-chains.ts || echo "Chains seeded (or already exist)"
	# Deploy executor to Minikube (builds images if needed)
	chmod +x ./deploy/local/hybrid/deploy.sh
	./deploy/local/hybrid/deploy.sh --build

hybrid-deploy-only:
	# Deploy executor to Minikube (skip image build, skip db setup)
	chmod +x ./deploy/local/hybrid/deploy.sh
	./deploy/local/hybrid/deploy.sh

hybrid-status:
	# Show status of hybrid deployment
	./deploy/local/hybrid/deploy.sh --status

hybrid-down:
	# Teardown hybrid deployment
	./deploy/local/hybrid/deploy.sh --teardown
	docker compose --profile minikube down

hybrid-reset:
	# Full reset: teardown, remove volumes, rebuild, and restart
	@echo "Tearing down hybrid deployment..."
	-./deploy/local/hybrid/deploy.sh --teardown 2>/dev/null || true
	docker compose --profile minikube down -v
	@echo "Rebuilding and starting fresh..."
	docker compose --profile minikube up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Running database migrations..."
	docker compose run --rm migrator || true
	@echo "Deploying scheduler to Minikube..."
	./deploy/local/hybrid/deploy.sh --build
	@echo ""
	@echo "Hybrid reset complete!"
	@echo "  App: http://localhost:3000"

hybrid-logs:
	# Follow job-spawner logs
	kubectl logs -n local -l app=job-spawner -f

hybrid-executor-logs:
	# Show schedule executor logs (same as hybrid-logs)
	kubectl logs -n local -l app=job-spawner --tail=100 2>/dev/null || echo "No executor logs available"

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
	@echo "    dev                        - Start development server (local)"
	@echo "    build                      - Build for production"
	@echo "    type-check                 - Run TypeScript type checking"
	@echo "    lint                       - Run linter"
	@echo "    fix                        - Fix linting issues"
	@echo ""
	@echo "  Docker Compose - Dev Profile (no K8s Jobs, ~2-3GB RAM):"
	@echo "    dev-setup                  - First time setup (services + migrations)"
	@echo "    dev-up                     - Start dev profile (fast, no migrations)"
	@echo "    dev-down                   - Stop dev profile"
	@echo "    dev-logs                   - Follow dev profile logs"
	@echo "    dev-migrate                - Run database migrations manually"
	@echo ""
	@echo "  Hybrid Mode (Docker Compose + Minikube, ~4-5GB RAM):"
	@echo "    hybrid-setup               - Full setup (compose, minikube, scheduler)"
	@echo "    hybrid-up                  - Start Docker Compose services"
	@echo "    hybrid-deploy              - Build and deploy scheduler to Minikube"
	@echo "    hybrid-deploy-only         - Deploy scheduler (skip build)"
	@echo "    hybrid-status              - Show hybrid deployment status"
	@echo "    hybrid-down                - Teardown hybrid deployment"
	@echo "    hybrid-reset               - Full reset and restart"
	@echo "    hybrid-logs                - Follow executor logs"
	@echo "    hybrid-executor-logs       - Show recent executor logs"
	@echo ""
	@echo "  Full Kubernetes (all in Minikube, ~8GB RAM):"
	@echo "    setup-local-kubernetes     - Setup minikube with all infrastructure"
	@echo "    check-local-kubernetes     - Quick check if environment is ready"
	@echo "    deploy-to-local-kubernetes - Build and deploy to minikube"
	@echo "    deploy-to-local-kubernetes-skip-build - Deploy without rebuilding"
	@echo "    status                     - Show pods and services status"
	@echo "    logs                       - Follow keeperhub pod logs"
	@echo "    restart                    - Restart keeperhub deployment"
	@echo "    teardown                   - Delete keeperhub resources from cluster"
	@echo ""
	@echo "  Database (Full K8s mode):"
	@echo "    db-create                  - Create keeperhub database in PostgreSQL"
	@echo "    db-migrate                 - Run database migrations on local kubernetes"
	@echo "    db-studio                  - Open Drizzle Studio"
	@echo ""
	@echo "  Schedule Trigger (Full K8s mode):"
	@echo "    build-scheduler-images     - Build and load scheduler + runner images"
	@echo "    deploy-scheduler           - Deploy dispatcher, job-spawner, RBAC"
	@echo "    scheduler-status           - Show scheduler pods and workflow jobs"
	@echo "    scheduler-logs             - Follow job-spawner logs"
	@echo "    runner-logs                - Show workflow runner job logs"
	@echo "    teardown-scheduler         - Remove scheduler components"
	@echo ""
	@echo "  Testing:"
	@echo "    test                       - Run all tests"
	@echo "    test-unit                  - Run unit tests"
	@echo "    test-integration           - Run integration tests"
	@echo "    test-e2e                   - Run E2E tests against local kubernetes"
	@echo "    test-e2e-hybrid            - Run E2E tests against hybrid deployment"
	@echo ""
	@echo "Recommended workflow:"
	@echo "  1. For UI/API dev (no workflow testing): make dev-up"
	@echo "  2. For scheduled workflow testing:        make hybrid-setup"
	@echo "  3. For production-like testing:          make setup-local-kubernetes"
