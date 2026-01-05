# Multi-stage Dockerfile for Next.js application
# Stage 1: Dependencies
FROM node:25-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY .npmrc* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:25-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create README.md if it doesn't exist to avoid build errors
RUN touch README.md || true

# Build the application
RUN pnpm build

# Stage 2.5: Migration stage (optional - for running migrations)
FROM node:25-alpine AS migrator
WORKDIR /app
RUN npm install -g pnpm

# Copy dependencies and migration files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/keeperhub ./keeperhub
COPY --from=builder /app/package.json ./package.json

# This stage can be used to run migrations
# Run with: docker build --target migrator -t keeperhub-migrator .
# Then: docker run --env DATABASE_URL=xxx keeperhub-migrator pnpm db:push

# Stage 2.6: Scheduler stage (for schedule dispatcher and job spawner)
FROM node:25-alpine AS scheduler
WORKDIR /app
RUN npm install -g pnpm tsx

# Copy dependencies and scheduler files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/keeperhub ./keeperhub
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production

# This stage is used for:
# - Schedule dispatcher (CronJob): sends messages to SQS
# - Job spawner (Deployment): polls SQS, creates K8s Jobs
#
# Build with: docker build --target scheduler -t keeperhub-scheduler .
# Run dispatcher: docker run keeperhub-scheduler tsx scripts/schedule-dispatcher.ts
# Run job spawner: docker run keeperhub-scheduler tsx scripts/job-spawner.ts

# Stage 2.7: Workflow Runner stage (for executing workflows in K8s Jobs)
FROM node:25-alpine AS workflow-runner
WORKDIR /app
RUN npm install -g pnpm tsx

# Copy dependencies and workflow execution files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/scripts/workflow-runner.ts ./scripts/workflow-runner.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/keeperhub ./keeperhub
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create a shim for 'server-only' package - the runner runs outside Next.js
# so we replace the package with an empty module that doesn't throw
# We need to replace it in the .pnpm folder where the actual package lives
RUN find /app/node_modules -path "*server-only*/index.js" | while read f; do echo 'module.exports = {};' > "$f"; done

ENV NODE_ENV=production

# This stage runs inside K8s Jobs to execute individual workflows
# Environment variables are passed by the job-spawner:
#   WORKFLOW_ID, EXECUTION_ID, SCHEDULE_ID, WORKFLOW_INPUT, DATABASE_URL
#
# Build with: docker build --target workflow-runner -t keeperhub-runner .
CMD ["tsx", "scripts/workflow-runner.ts"]

# Stage 3: Runner
FROM node:25-alpine AS runner
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
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server.js"]
