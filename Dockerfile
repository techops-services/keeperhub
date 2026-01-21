# Multi-stage Dockerfile for Next.js application (Hybrid Node.js + Bun)
#
# Strategy:
# - Node.js for production app (full Sentry tracing support)
# - Bun for background services (faster startup, native TypeScript)
#
# See docs/keeperhub/KEEP-1241/ for migration notes and known issues.
#
# =============================================================================
# Stage 1: Dependencies (Bun for fast installs)
# =============================================================================
FROM oven/bun:1.2-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files (supports both pnpm and bun lockfiles)
COPY package.json pnpm-lock.yaml* bun.lockb* ./
COPY .npmrc* ./

# Install dependencies with Bun (faster than pnpm/npm)
RUN bun install --frozen-lockfile

# =============================================================================
# Stage 2: Source (dependencies + source files, no build)
# =============================================================================
FROM oven/bun:1.2-alpine AS source
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# =============================================================================
# Stage 2.5: Builder (runs Next.js build, only needed for runner stage)
# =============================================================================
FROM source AS builder

# Create README.md if it doesn't exist to avoid build errors
RUN touch README.md || true

# Build the application
RUN bun run build

# =============================================================================
# Stage 2.6: Migration stage (Bun - no tracing needed)
# =============================================================================
FROM oven/bun:1.2-alpine AS migrator
WORKDIR /app

# Copy dependencies, migration files, and seed scripts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=source /app/drizzle ./drizzle
COPY --from=source /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=source /app/lib ./lib
COPY --from=source /app/keeperhub ./keeperhub
COPY --from=source /app/scripts ./scripts
COPY --from=source /app/package.json ./package.json
COPY --from=source /app/tsconfig.json ./tsconfig.json

# This stage runs migrations and seeds default data
# Build with: docker build --target migrator -t keeperhub-migrator .
# Run setup (migrations + seed): docker run --env DATABASE_URL=xxx keeperhub-migrator bun run db:setup
# Run migrations only: docker run --env DATABASE_URL=xxx keeperhub-migrator bun run db:migrate
# Run seed only: docker run --env DATABASE_URL=xxx keeperhub-migrator bun run db:seed

# =============================================================================
# Stage 2.7: Scheduler stage (Bun - no tracing needed)
# For schedule dispatcher and job spawner - background processes
# =============================================================================
FROM oven/bun:1.2-alpine AS scheduler
WORKDIR /app

# Copy dependencies and scheduler files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=source /app/scripts ./scripts
COPY --from=source /app/lib ./lib
COPY --from=source /app/keeperhub ./keeperhub
COPY --from=source /app/package.json ./package.json
COPY --from=source /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production

# This stage is used for:
# - Schedule dispatcher (CronJob): sends messages to SQS
# - Job spawner (Deployment): polls SQS, creates K8s Jobs
#
# Build with: docker build --target scheduler -t keeperhub-scheduler .
# Run dispatcher: docker run keeperhub-scheduler bun scripts/schedule-dispatcher.ts
# Run job spawner: docker run keeperhub-scheduler bun scripts/job-spawner.ts

# =============================================================================
# Stage 2.8: Workflow Runner stage (Bun - no tracing needed)
# Executes workflows in K8s Jobs - errors logged to DB
# =============================================================================
FROM oven/bun:1.2-alpine AS workflow-runner
WORKDIR /app

# Copy dependencies and workflow execution files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=source /app/scripts/workflow-runner.ts ./scripts/workflow-runner.ts
COPY --from=source /app/lib ./lib
COPY --from=source /app/plugins ./plugins
COPY --from=source /app/keeperhub ./keeperhub
COPY --from=source /app/package.json ./package.json
COPY --from=source /app/tsconfig.json ./tsconfig.json

# Copy auto-generated files from builder stage (step-registry.ts, etc. are in .gitignore)
COPY --from=builder /app/lib/step-registry.ts ./lib/step-registry.ts
COPY --from=builder /app/lib/codegen-registry.ts ./lib/codegen-registry.ts
COPY --from=builder /app/lib/output-display-configs.ts ./lib/output-display-configs.ts
COPY --from=builder /app/lib/types/integration.ts ./lib/types/integration.ts
COPY --from=builder /app/plugins/index.ts ./plugins/index.ts
COPY --from=builder /app/keeperhub/plugins/index.ts ./keeperhub/plugins/index.ts

# Create a shim for 'server-only' package - the runner runs outside Next.js
# so we replace the package with an empty module that doesn't throw
RUN find /app/node_modules -path "*server-only*/index.js" | while read f; do echo 'module.exports = {};' > "$f"; done

ENV NODE_ENV=production

# This stage runs inside K8s Jobs to execute individual workflows
# Environment variables are passed by the job-spawner:
#   WORKFLOW_ID, EXECUTION_ID, SCHEDULE_ID, WORKFLOW_INPUT, DATABASE_URL
#
# Build with: docker build --target workflow-runner -t keeperhub-runner .
CMD ["bun", "scripts/workflow-runner.ts"]

# =============================================================================
# Stage 3: Runner (Bun - EXPERIMENTAL full Bun runtime)
# Bun has AsyncLocalStorage implemented - testing if Sentry tracing works
# =============================================================================
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

# Start the application with Bun
# Note: AsyncLocalStorage is implemented, testing if Sentry tracing works
CMD ["bun", "server.js"]
