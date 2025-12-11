.DEFAULT_GOAL := help
.PHONY: help install dev build type-check lint fix deploy-to-local-kubernetes setup-local-kubernetes check-local-kubernetes status logs restart teardown db-create db-migrate db-studio

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
