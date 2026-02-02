# KeeperHub

KeeperHub is a no-code blockchain automation platform - "Zapier for Web3". Create and manage custom blockchain automations without coding knowledge, infrastructure management, or deep blockchain expertise.

## What KeeperHub Does

- **Visual Workflow Builder**: Drag-and-drop interface for building blockchain automations
- **Smart Contract Interactions**: Read and write to smart contracts without writing code
- **Multi-Chain Support**: Ethereum Mainnet, Sepolia, Base, Arbitrum, and more
- **Secure Wallet Management**: Para-integrated MPC wallets with no private key exposure
- **Notifications**: Email, Discord, Slack, and webhook integrations
- **Scheduling**: Cron-based, event-driven, webhook, or manual triggers
- **AI-Assisted Building**: Describe automations in plain language

## Key Features

### Triggers
- **Scheduled**: Run at intervals (every 5 minutes, hourly, daily, custom cron)
- **Webhook**: Execute when external services call your workflow URL
- **Event**: React to blockchain events (token transfers, contract state changes)
- **Manual**: On-demand execution via UI or API

### Actions
- **Web3**: Check Balance, Read Contract, Write Contract, Transfer Funds, Transfer Tokens
- **Notifications**: Send Email, Discord Message, Slack Message, Telegram Message
- **Integrations**: Send Webhook, custom HTTP requests

### Conditions
- Low balance detection
- Value comparisons
- Custom logic with AND/OR operators

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm package manager

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/keeperhub

# Authentication
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# AI (choose one)
OPENAI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4o

# Para Wallet
PARA_API_KEY=your-para-api-key
PARA_ENVIRONMENT=beta

# Encryption
WALLET_ENCRYPTION_KEY=your-wallet-encryption-key
INTEGRATION_ENCRYPTION_KEY=your-integration-encryption-key
```

### Installation

```bash
pnpm install
pnpm db:push
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to get started.

## Running Modes

### Local Development (Simplest)

For UI/API development without Docker:

```bash
pnpm install
pnpm db:push
pnpm dev
```

### Dev Mode with Docker

Full development stack with scheduled workflow execution:

```bash
make dev-setup    # First time (starts services + migrations)
make dev-up       # Subsequent starts
make dev-logs     # View logs
make dev-down     # Stop services
```

Services: PostgreSQL (5433), LocalStack SQS (4566), KeeperHub App (3000), Schedule Dispatcher, Schedule Executor

### Hybrid Mode with K8s Jobs

For testing workflow execution in isolated K8s Job containers:

```bash
make hybrid-setup     # Full setup
make hybrid-status    # View status
make hybrid-down      # Teardown
```

## Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm type-check       # TypeScript check
pnpm check            # Run linter
pnpm fix              # Fix linting issues

# Database
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed chain data

# Plugins
pnpm discover-plugins # Scan and register plugins
pnpm create-plugin    # Create new plugin

# Testing
pnpm test             # Run all tests
pnpm test:e2e         # E2E tests
```

## Architecture

### Core Services

- **KeeperHub App**: Next.js application with workflow builder UI and API
- **Schedule Dispatcher**: Evaluates cron schedules, queues workflows to SQS
- **Schedule Executor**: Polls SQS, executes workflows via API

### Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui, Radix UI, Tailwind CSS 4
- **Database**: PostgreSQL with Drizzle ORM
- **Workflow Engine**: Workflow DevKit
- **Authentication**: Better Auth
- **AI**: Vercel AI SDK (OpenAI/Anthropic)
- **Wallets**: Para MPC integration

### Plugin System

Plugins extend workflow capabilities. Located in `keeperhub/plugins/`:

- `web3` - Blockchain operations (balance, transfers, contract calls)
- `discord` - Discord notifications
- `sendgrid` - Email via SendGrid
- `webhook` - HTTP integrations
- `telegram` - Telegram notifications

## API

Base URL: `https://app.keeperhub.com/api`

### Endpoints

| Resource | Description |
|----------|-------------|
| `/api/workflows` | CRUD for workflows |
| `/api/workflows/{id}/execute` | Execute a workflow |
| `/api/workflows/{id}/executions` | Execution history |
| `/api/integrations` | Manage connections |
| `/api/chains` | Supported networks |

See [API Documentation](docs/api/index.md) for full reference.

## Observability

Prometheus metrics exposed at `/api/metrics`:

- Workflow execution performance
- API latency
- Plugin action metrics
- User and organization stats

See [Metrics Reference](keeperhub/lib/metrics/METRICS_REFERENCE.md) for details.

## Documentation

Full documentation available at [docs.keeperhub.com](https://docs.keeperhub.com) or in the `docs/` directory:

- [Quick Start Guide](docs/getting-started/quickstart.md)
- [Core Concepts](docs/intro/concepts.md)
- [Workflow Examples](docs/workflows/examples.md)
- [API Reference](docs/api/index.md)
- [Security Best Practices](docs/practices/security.md)

## License

Apache 2.0
