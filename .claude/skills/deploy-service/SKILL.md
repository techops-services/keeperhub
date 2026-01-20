---
name: deploy-service
description: Deploy a new service to Kubernetes with full infrastructure setup. Creates Terraform definitions, PR, workspace, SSM parameters, and GitHub Actions workflows. Use when deploying a new service or setting up deployment pipeline for an existing service.
---

# Deploy Service Workflow

Orchestrate the full deployment setup for a new service including Terraform infrastructure, GitHub Actions workflows, and Kubernetes deployment via Helm.

## Prerequisites

- Service has a Dockerfile ready
- Access to infrastructure repo (techops-services/infrastructure)
- Access to Terraform Cloud (SkyEcosystem org)
- Common Helm chart available at https://techops-services.github.io/helm-charts

## Phase 1: Service Discovery

**Step 1.1: Identify Service**
```
If service not specified, ask user:
- Service name
- Service directory path
- Service repository (if different from current)
```

**Step 1.2: Analyze Service Requirements**
```
Read service's:
- Dockerfile (to understand build process)
- .env.example or similar (to identify required secrets/parameters)
- package.json or equivalent (to understand service type)
```

**Step 1.3: Interview for Infrastructure Needs**
```
Use AskUserQuestion to determine:
- Which environment(s): staging, prod, or both
- Required infrastructure resources:
  - ECR (container registry) - usually always needed
  - SSM Parameters (secrets) - based on .env.example
  - SQS queues (if async processing needed)
  - Redis (if caching/sessions needed)
  - RDS (if dedicated database needed)
- Any custom GitHub secrets beyond org-wide AWS secrets
```

## Phase 2: Create Terraform Definitions

**Step 2.1: Create Infrastructure Directory**
```
In infrastructure repo, create directory structure:
{environment}/{service-name}/
  ├── config.tf      # Terraform/provider configuration
  ├── variables.tf   # Input variables
  ├── data.tf        # Data sources (remote state, etc.)
  ├── ecr.tf         # ECR repository (if needed)
  ├── parameters.tf  # SSM parameters (if needed)
  ├── sqs.tf         # SQS queues (if needed)
  ├── redis.tf       # Redis/Elasticache (if needed)
  ├── outputs.tf     # Output values
```

**Step 2.2: Use Existing Patterns**
```
Reference existing services for patterns:
- staging/keeper-app/ for full-stack services
- staging/keeperhub-landing/ for simpler services
- prod/vibeyard/ for standalone services

Key patterns:
- config.tf: TFC workspace config, provider setup with assume_role
- variables.tf: tf_cloud_role, region, name, environment, cluster_name, tags
- data.tf: Remote state for EKS, VPC; EKS cluster auth
- ecr.tf: Use terraform-aws-modules/ecr/aws module
- parameters.tf: SSM params with placeholder values and lifecycle ignore_changes
```

**Step 2.3: SSM Parameter Naming**
```
Follow pattern: /eks/{cluster_name}/{service_name}/{param-name}
Example: /eks/maker-staging/feedback-service/openai-api-key

Create placeholder parameters for all secrets from .env.example
Use "placeholder" as initial value with lifecycle { ignore_changes = [value] }
User will populate actual values manually after deployment
```

## Phase 3: Submit Infrastructure PR

**Step 3.1: Create Feature Branch**
```
In infrastructure repo:
git checkout -b feature/{service-name}-infrastructure
git add {environment}/{service-name}/
git commit -m "feat: add {service-name} infrastructure for {environment}"
git push -u origin feature/{service-name}-infrastructure
```

**Step 3.2: Create Pull Request**
```
Use gh pr create:
- Title: "feat: Add {service-name} infrastructure ({environment})"
- Body: List of resources being created, link to service repo
- Request review if needed
```

**Step 3.3: Note PR Branch**
```
Store the PR branch name for Terraform workspace VCS configuration
Example: feature/feedback-service-infrastructure
```

## Phase 4: Create Terraform Workspace

**Step 4.1: Create Workspace**
```
Use mcp__terraform__create_workspace:
- terraform_org_name: "SkyEcosystem"
- workspace_name: "{service-name}-{environment}" (e.g., feedback-service-staging)
- description: "Infrastructure for {service-name} in {environment}"
- execution_mode: "remote"
- auto_apply: "false" (require manual approval)
- vcs_repo_identifier: "techops-services/infrastructure"
- vcs_repo_branch: "{PR branch name}" (set to PR branch initially)
- working_directory: "{environment}/{service-name}"
```

**Step 4.2: Set Workspace Variables**
```
Use mcp__terraform__create_workspace_variable for each:
- tf_cloud_role: AWS role ARN for Terraform Cloud
- region: "us-east-2" (or appropriate region)
- cloudflare_account_id: (if using Cloudflare)
- Any other required variables from variables.tf
```

**Step 4.3: Configure Trigger Patterns**
```
Set trigger patterns to only run on changes to the service directory:
- Pattern: "{environment}/{service-name}/**/*"
This ensures the workspace only triggers on relevant changes
```

## Phase 5: Apply Infrastructure

**Step 5.1: Trigger Plan**
```
Use mcp__terraform__create_run:
- terraform_org_name: "SkyEcosystem"
- workspace_name: "{service-name}-{environment}"
- run_type: "plan_only"
- message: "Initial infrastructure setup for {service-name}"
```

**Step 5.2: Review Plan**
```
Use mcp__terraform__get_run_details to check plan status
Present plan summary to user:
- Resources to be created
- Any potential issues or warnings
```

**Step 5.3: User Approval**
```
Use AskUserQuestion:
"Terraform plan is ready. Review the plan in Terraform Cloud and confirm when ready to apply."
Options:
- "Plan looks good, apply it"
- "I need to make changes first"
- "Cancel deployment"
```

**Step 5.4: Apply (After User Approval)**
```
Use mcp__terraform__create_run:
- run_type: "plan_and_apply"
Wait for apply to complete, monitor status
```

**Step 5.5: Handle Failures**
```
If apply fails:
1. Use mcp__terraform__get_run_details to get error details
2. Analyze the error and suggest fixes
3. Offer to retry after user makes corrections
```

## Phase 6: Post-Merge Workspace Update

**Step 6.1: Merge PR**
```
Use AskUserQuestion:
"Infrastructure PR is ready to merge. Please merge the PR and confirm."
```

**Step 6.2: Update Workspace VCS Branch**
```
After PR is merged, use mcp__terraform__update_workspace:
- Reset vcs_repo_branch to default branch (main)
- This ensures future runs trigger from the main branch
```

## Phase 7: Create GitHub Workflow and Values

**Step 7.1: Create Deploy Directory Structure**
```
In service repository, create:
deploy/
  ├── staging/
  │   └── values.yaml
  └── prod/
      └── values.yaml
```

**Step 7.2: Create Values File**

**IMPORTANT**: The `service.tls` section MUST always be defined, even for internal services.
The common Helm chart's `certificate.yaml` template accesses `.Values.service.tls.enabled`
without nil-checking. Omitting `tls` causes: `nil pointer evaluating interface {}.enabled`

```yaml
# deploy/{environment}/values.yaml
# Use existing keeperhub values as reference pattern

replicaCount: 1

# For services WITH ingress (external):
service:
  enabled: true
  name: {service-name}-{environment}
  port: {service-port}
  type: ClusterIP
  containerPort: {service-port}
  tls:
    enabled: true        # Creates Certificate resource
    issuerName: cloudflare

# For services WITHOUT ingress (internal only):
# service:
#   enabled: true
#   name: {service-name}-{environment}
#   port: {service-port}
#   type: ClusterIP
#   containerPort: {service-port}
#   tls:
#     enabled: false     # REQUIRED - must be explicitly set to false

ingress:
  enabled: true  # or false if internal only
  hosts:
    - {service-name}-{environment}.keeperhub.com
  annotations:
    external-dns.alpha.kubernetes.io/cloudflare-proxied: "true"
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.options: traefik-cloudflare-origin-pull@kubernetescrd

image:
  repository: ${ECR_REGISTRY}/{ecr-repo-name}
  tag: app-${IMAGE_TAG}
  pullPolicy: Always

deployment:
  enabled: true

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: ${SERVICE_ACCOUNT_ROLE_ARN}
  name: {service-name}-{environment}

podAnnotations:
  reloader.stakater.com/auto: "true"

resources:
  limits:
    memory: 512Mi
  requests:
    cpu: 1m
    memory: 128Mi

env:
  # Plain key-value environment variables
  LOG_LEVEL:
    type: kv
    value: "info"
  NODE_ENV:
    type: kv
    value: "production"
  # SSM Parameter Store secrets
  # Example:
  # API_KEY:
  #   type: parameterStore
  #   name: api-key
  #   parameter_name: /eks/{cluster}/{service}/api-key

externalSecrets:
  clusterSecretStoreName: {cluster-name}  # maker-staging or maker-prod

livenessProbe:
  initialDelaySeconds: 5
  periodSeconds: 30
  tcpSocket:
    port: {service-port}
readinessProbe:
  initialDelaySeconds: 5
  periodSeconds: 30
  tcpSocket:
    port: {service-port}
```

**Step 7.3: Create GitHub Workflow**
```
Create .github/workflows/deploy.yaml in service repo:
```

```yaml
on:
  push:
    branches:
      - staging
      - main
  workflow_dispatch:

name: deploy-{service-name}

jobs:
  build-and-deploy:
    environment: ${{ github.ref == 'refs/heads/main' && 'prod' || 'staging' }}
    runs-on: ubuntu-latest
    env:
      HELM_FILE: deploy/${{ github.ref == 'refs/heads/main' && 'prod' || 'staging' }}/values.yaml
      REGION: ${{ github.ref == 'refs/heads/main' && 'us-east-1' || 'us-east-2' }}
      CLUSTER_NAME: ${{ github.ref == 'refs/heads/main' && 'maker-prod' || 'maker-staging' }}
      ENVIRONMENT_TAG: ${{ github.ref == 'refs/heads/main' && 'prod' || 'staging' }}
      NAMESPACE: {namespace}
      SERVICE_NAME: {service-name}
      AWS_ECR_NAME: {service-name}-${{ github.ref == 'refs/heads/main' && 'prod' || 'staging' }}
      SERVICE_ACCOUNT_ROLE_ARN: ${{ vars.SERVICE_ACCOUNT_ROLE_ARN }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ github.ref == 'refs/heads/main' && secrets.AWS_ACCESS_KEY_ID || secrets.STAGING_AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ github.ref == 'refs/heads/main' && secrets.AWS_SECRET_ACCESS_KEY || secrets.STAGING_AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.REGION }}

      - name: Login to AWS ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set up Docker Buildx
        if: ${{ !contains(github.event.head_commit.message, '[skip build]') }}
        uses: docker/setup-buildx-action@v3

      - name: Extract commit hash
        id: vars
        if: ${{ !contains(github.event.head_commit.message, '[skip build]') }}
        shell: bash
        run: |
          echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Build, tag, and push image to ECR
        id: build-image
        if: ${{ !contains(github.event.head_commit.message, '[skip build]') }}
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/${{ env.AWS_ECR_NAME }}:app-${{ steps.vars.outputs.sha_short }}
            ${{ steps.login-ecr.outputs.registry }}/${{ env.AWS_ECR_NAME }}:app-latest
            ${{ steps.login-ecr.outputs.registry }}/${{ env.AWS_ECR_NAME }}:${{ env.ENVIRONMENT_TAG }}
          cache-from: type=registry,ref=${{ steps.login-ecr.outputs.registry }}/${{ env.AWS_ECR_NAME }}:cache-app
          cache-to: type=registry,ref=${{ steps.login-ecr.outputs.registry }}/${{ env.AWS_ECR_NAME }}:cache-app,mode=max

      - name: Replace variables in the Helm values file
        if: ${{ !contains(github.event.head_commit.message, '[skip deploy]') }}
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ steps.vars.outputs.sha_short }}
          SERVICE_ACCOUNT_ROLE_ARN: ${{ env.SERVICE_ACCOUNT_ROLE_ARN }}
        run: |
          sed -i 's|${ECR_REGISTRY}|'"$ECR_REGISTRY"'|g' $HELM_FILE
          sed -i 's|${IMAGE_TAG}|'"$IMAGE_TAG"'|g' $HELM_FILE
          sed -i 's|${SERVICE_ACCOUNT_ROLE_ARN}|'"$SERVICE_ACCOUNT_ROLE_ARN"'|g' $HELM_FILE

      - name: Configure kubectl
        if: ${{ !contains(github.event.head_commit.message, '[skip deploy]') }}
        run: |
          aws eks update-kubeconfig --name ${{ env.CLUSTER_NAME }} --region ${{ env.REGION }}

      - name: Deploy to Kubernetes with Helm
        if: ${{ !contains(github.event.head_commit.message, '[skip deploy]') }}
        uses: bitovi/github-actions-deploy-eks-helm@v1.2.10
        with:
          cluster-name: ${{ env.CLUSTER_NAME }}
          config-files: ${{ env.HELM_FILE }}
          chart-path: techops-services/common
          namespace: ${{ env.NAMESPACE }}
          timeout: 5m0s
          name: ${{ env.SERVICE_NAME }}
          chart-repository: https://techops-services.github.io/helm-charts
          version: 0.2.1
          atomic: true
```

**Step 7.4: Add GitHub Secrets/Variables**
```
Use AskUserQuestion to identify any custom secrets needed
AWS secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are org-wide

Required repository variables (use gh variable set):
- SERVICE_ACCOUNT_ROLE_ARN: IAM role ARN for the service account

Add any service-specific secrets using gh secret set
```

## Phase 8: Trigger Initial Deployment

**Step 8.1: User Confirmation**
```
Use AskUserQuestion:
"GitHub workflow is ready. Do you want to trigger the initial deployment?"
Options:
- "Yes, trigger deployment to staging"
- "Yes, trigger deployment to prod"
- "No, I'll trigger it manually"
```

**Step 8.2: Trigger Workflow**
```
If user confirms, use gh workflow run or push to trigger branch
```

**Step 8.3: Verify Deployment**
```
After workflow completes:
1. Check pod status: kubectl get pods -n {namespace} -l app={service-name}
2. Verify pods are Running
3. Report deployment status to user
```

## Phase 9: Completion Summary

**Step 9.1: Generate Summary**
```
Provide summary of what was created:
- Infrastructure directory path in infrastructure repo
- Terraform workspace name and URL
- SSM parameters created (remind user to populate values manually)
- GitHub workflow file path
- Helm values file paths
- Deployment status
```

**Step 9.2: Next Steps**
```
Remind user of manual steps:
1. Populate SSM parameter values in AWS Console
2. Configure any DNS/ingress if needed
3. Set up monitoring/alerting if needed
4. Add SERVICE_ACCOUNT_ROLE_ARN variable if not set
```

## Enforcement Rules

- Always interview user for infrastructure requirements before creating resources
- Never apply Terraform without explicit user approval
- Always set workspace VCS branch to PR branch initially, reset to main after merge
- Create SSM parameters with placeholder values only (user populates manually)
- Use common Helm chart from techops-services/helm-charts (version 0.2.1)
- Follow values.yaml structure from existing keeperhub deployment
- **Always include `service.tls.enabled` in values.yaml** (true or false) - omitting causes nil pointer error
- Verify pod status after deployment
- On any failure, analyze error and offer guidance before retry
