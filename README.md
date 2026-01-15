# AI Workflow Builder Template

A template for building your own AI-driven workflow automation platform. Built on top of Workflow DevKit, this template provides a complete visual workflow builder with real integrations and code generation capabilities.

![AI Workflow Builder Screenshot](screenshot.png)

## Deploy Your Own

You can deploy your own version of the workflow builder to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.new/workflow-builder)

**What happens during deployment:**

- **Automatic Database Setup**: A Neon Postgres database is automatically created and connected to your project
- **Environment Configuration**: You'll be prompted to provide required environment variables (Better Auth credentials and AI Gateway API key)
- **Ready to Use**: After deployment, you can start building workflows immediately

## What's Included

- **Visual Workflow Builder** - Drag-and-drop interface powered by React Flow
- **Workflow DevKit Integration** - Built on top of Workflow DevKit for powerful execution capabilities
- **Real Integrations** - Connect to Resend (emails), Linear (tickets), Slack, PostgreSQL, and external APIs
- **Code Generation** - Convert workflows to executable TypeScript with `"use workflow"` directive
- **Execution Tracking** - Monitor workflow runs with detailed logs
- **Authentication** - Secure user authentication with Better Auth
- **AI-Powered** - Generate workflows from natural language descriptions using OpenAI
- **Database** - PostgreSQL with Drizzle ORM for type-safe database access
- **Modern UI** - Beautiful shadcn/ui components with dark mode support

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm package manager

### Environment Variables

Create a `.env.local` file with the following:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/workflow_builder

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# AI Configuration - Choose ONE option based on your setup:

# Option 1: Vercel AI Gateway (recommended for production)
# Provides caching, rate limiting, and monitoring across multiple AI providers
# AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key
# AI_MODEL=openai/gpt-4o  # Use provider/model format for gateway

# Option 2: Direct OpenAI API (simple, no Vercel account needed)
OPENAI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4o  # Options: gpt-4o, gpt-4o-mini, gpt-3.5-turbo

# Option 3: Direct Anthropic API
# ANTHROPIC_API_KEY=your-anthropic-api-key
# AI_MODEL=claude-3-5-sonnet-20241022  # Or other Claude models
```

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys and tokens in `.env`

3. (Recommended) Use [direnv](https://direnv.net/) to auto-load environment variables:
   ```bash
   brew install direnv
   echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
   source ~/.zshrc
   direnv allow
   ```

### Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to get started.

## Running the Application

KeeperHub supports multiple deployment modes depending on your development needs:

### Option 1: Local Development (Simplest)

For UI/API development without Docker:

```bash
pnpm install
pnpm db:push
pnpm dev
```

**Requirements:** Node.js 18+, PostgreSQL database

### Option 2: Dev Mode with Docker (~2-3GB RAM)

Full development stack with scheduled workflow execution (no K8s Jobs):

```bash
# First time setup (starts services + runs migrations)
make dev-setup

# Subsequent starts (faster, skips migrations)
make dev-up

# View logs
make dev-logs

# Stop services
make dev-down
```

**Services started:**
- PostgreSQL (port 5433)
- LocalStack SQS (port 4566)
- KeeperHub App (port 3000)
- Schedule Dispatcher (runs every minute)
- Schedule Executor (polls SQS, calls API directly)

### Option 3: Hybrid Mode with K8s Jobs (~4-5GB RAM)

For testing workflow execution in isolated K8s Job containers:

```bash
# Full setup (first time)
make hybrid-setup

# Or step by step:
make hybrid-up           # Start Docker services
make hybrid-deploy       # Build and deploy to Minikube

# View status
make hybrid-status

# View logs
make hybrid-logs         # Job spawner logs
make hybrid-runner-logs  # Workflow runner logs

# Teardown
make hybrid-down
```

**Architecture:**
- Docker Compose: PostgreSQL, LocalStack, KeeperHub App
- Minikube: Schedule Dispatcher (CronJob), Job Spawner, Workflow Runner Jobs

### Option 4: Full Kubernetes (~8GB RAM)

All services running in Minikube:

```bash
make setup-local-kubernetes
make deploy-to-local-kubernetes
make deploy-scheduler
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Specific Test Suites

```bash
# Unit tests
pnpm test -- --run tests/unit/

# Integration tests
pnpm test -- --run tests/integration/

# Workflow runner E2E tests (requires PostgreSQL on port 5433)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/keeperhub" \
  pnpm test -- --run tests/e2e/workflow-runner.test.ts
```

### E2E Tests Against Local Kubernetes

```bash
make test-e2e
```

### Manual Workflow Runner Testing

Test the workflow runner directly:

```bash
# With bootstrap script (patches server-only)
WORKFLOW_ID=<id> EXECUTION_ID=<id> DATABASE_URL=<url> \
  node scripts/workflow-runner-bootstrap.cjs

# In Docker container
docker run --rm --network host \
  -e WORKFLOW_ID=<id> \
  -e EXECUTION_ID=<id> \
  -e DATABASE_URL=<url> \
  keeperhub-runner:latest
```

## Workflow Types

### Trigger Nodes

- Webhook
- Schedule
- Manual
- Database Event

### Action Nodes

<!-- PLUGINS:START - Do not remove. Auto-generated by discover-plugins -->
- **Slack**: Send Slack Message
- **Discord**: Send Discord Message
- **Email**: Send Email
- **Web3**: Check Balance, Check Token Balance, Transfer Funds, Transfer Token, Read Contract, Write Contract
- **Webhook**: Send Webhook
<!-- PLUGINS:END -->

## Code Generation

Workflows can be converted to executable TypeScript code with the `"use workflow"` directive:

```typescript
export async function welcome(email: string, name: string, plan: string) {
  "use workflow";

  const { subject, body } = await generateEmail({
    name,
    plan,
  });

  const { status } = await sendEmail({
    to: email,
    subject,
    body,
  });

  return { status, subject, body };
}
```

### Generate Code for a Workflow

```bash
# Via API
GET /api/workflows/{id}/generate-code
```

The generated code includes:

- Type-safe TypeScript
- Real integration calls
- Error handling
- Execution logging

## API Endpoints

### Workflow Management

- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows/{id}` - Get workflow by ID
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow

### Workflow Execution

- `POST /api/workflows/{id}/execute` - Execute a workflow
- `GET /api/workflows/{id}/executions` - Get execution history
- `GET /api/workflows/executions/{executionId}/logs` - Get detailed execution logs

### Code Generation

- `GET /api/workflows/{id}/generate-code` - Generate TypeScript code
- `POST /api/workflows/{id}/generate-code` - Generate with custom options

### AI Generation

- `POST /api/ai/generate-workflow` - Generate workflow from prompt

## Database Schema

### Tables

- `user` - User accounts
- `session` - User sessions
- `workflows` - Workflow definitions
- `workflow_executions` - Execution history
- `workflow_execution_logs` - Detailed node execution logs

## Development

### Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production
pnpm type-check       # Run TypeScript type checking
pnpm check            # Run linter
pnpm fix              # Fix linting issues

# Database
pnpm db:generate      # Generate migrations
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run all tests
pnpm test -- --watch  # Run tests in watch mode
```

### Make Commands

```bash
# Show all available commands
make help

# Docker Compose (Dev Mode)
make dev-setup        # First time setup (services + migrations)
make dev-up           # Start dev profile (fast, no migrations)
make dev-down         # Stop dev profile
make dev-logs         # Follow logs
make dev-migrate      # Run migrations manually

# Hybrid Mode (Docker + Minikube)
make hybrid-setup     # Full setup
make hybrid-up        # Start Docker services
make hybrid-deploy    # Deploy to Minikube
make hybrid-status    # Show status
make hybrid-logs      # Job spawner logs
make hybrid-down      # Teardown

# Full Kubernetes
make setup-local-kubernetes
make deploy-to-local-kubernetes
make status
make logs
make teardown

# Scheduler
make build-scheduler-images
make deploy-scheduler
make scheduler-status
make scheduler-logs
make runner-logs
```

## Observability & Metrics

KeeperHub includes a metrics system based on the **Four Golden Signals** (Latency, Traffic, Errors, Saturation). Metrics are exposed via Prometheus at `/api/metrics` and visualized in Grafana.

**What's tracked:**
- Workflow execution performance (duration, queue depth, error rates)
- API latency (webhooks, status polling)
- Plugin action metrics (duration, invocations, errors)
- User & organization stats (totals, active users, members)
- Infrastructure (Para wallets, chains, integrations, schedules)

📖 **[Metrics Reference](keeperhub/lib/metrics/METRICS_REFERENCE.md)** - Complete list of 30+ metrics, labels, Prometheus names, and instrumentation patterns

## Integrations

### Resend (Email)

Send transactional emails with Resend's API.

```typescript
import { sendEmail } from "@/lib/integrations/resend";

await sendEmail({
  to: "user@example.com",
  subject: "Welcome!",
  body: "Welcome to our platform",
});
```

### Linear (Tickets)

Create and manage Linear issues.

```typescript
import { createTicket } from "@/lib/integrations/linear";

await createTicket({
  title: "Bug Report",
  description: "Something is broken",
  priority: 1,
});
```

### PostgreSQL

Direct database access for queries and updates.

```typescript
import { queryData } from "@/lib/integrations/database";

await queryData("users", { email: "user@example.com" });
```

### External APIs

Make HTTP requests to any API.

```typescript
import { callApi } from "@/lib/integrations/api";

await callApi({
  url: "https://api.example.com/endpoint",
  method: "POST",
  body: { data: "value" },
});
```

### Firecrawl (Web Scraping)

Scrape websites and search the web with Firecrawl.

```typescript
import {
  firecrawlScrapeStep,
  firecrawlSearchStep,
} from "@/lib/steps/firecrawl";

// Scrape a URL
const scrapeResult = await firecrawlScrapeStep({
  url: "https://example.com",
  formats: ["markdown"],
});

// Search the web
const searchResult = await firecrawlSearchStep({
  query: "AI workflow builders",
  limit: 5,
});
```

## MCP Servers (Claude Code)

The project includes MCP server configurations in `.mcp.json` for enhanced Claude Code development:

- **terraform** - Terraform Cloud workspace management
- **mcp-obsidian** - Obsidian vault integration
- **chrome-devtools** - Browser automation and debugging
- **memory** - Persistent memory across sessions

Required environment variables (set in `.env`):
```bash
TFE_TOKEN=       # Terraform Cloud API token
OBSIDIAN_API_KEY= # Obsidian Local REST API key
```

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Workflow Engine**: Workflow DevKit
- **UI**: shadcn/ui with Tailwind CSS
- **State Management**: Jotai
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Code Editor**: Monaco Editor
- **Workflow Canvas**: React Flow
- **AI**: OpenAI GPT-5
- **Type Checking**: TypeScript
- **Code Quality**: Ultracite (formatter + linter)

## About Workflow DevKit

This template is built on top of Workflow DevKit, a powerful workflow execution engine that enables:

- Native TypeScript workflow definitions with `"use workflow"` directive
- Type-safe workflow execution
- Automatic code generation from visual workflows
- Built-in logging and error handling
- Serverless deployment support

Learn more about Workflow DevKit at [useworkflow.dev](https://useworkflow.dev)

## License

Apache 2.0
