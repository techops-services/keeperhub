# Multi-stage Dockerfile for Next.js application
# Stage 1: Dependencies
FROM node:25-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN wget -O /etc/ssl/certs/rds-combined-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY .npmrc* ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Stage 2: Source (dependencies + source files, no build)
FROM node:25-alpine AS source
WORKDIR /app
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Stage 2.5: Builder (runs Next.js build, only needed for runner stage)
FROM source AS builder

# Create README.md if it doesn't exist to avoid build errors
RUN touch README.md || true

# Set environment variables for social providers
ARG NEXT_PUBLIC_AUTH_PROVIDERS
ARG NEXT_PUBLIC_GITHUB_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_AUTH_PROVIDERS=$NEXT_PUBLIC_AUTH_PROVIDERS
ENV NEXT_PUBLIC_GITHUB_CLIENT_ID=$NEXT_PUBLIC_GITHUB_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Build the application
RUN pnpm build

# Stage 2.6: Migration stage (for running migrations and seeding)
FROM node:25-alpine AS migrator
WORKDIR /app
RUN npm install -g pnpm tsx
COPY --from=deps /etc/ssl/certs/rds-combined-ca-bundle.pem /etc/ssl/certs/rds-combined-ca-bundle.pem

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
# Run setup (migrations + seed): docker run --env DATABASE_URL=xxx keeperhub-migrator pnpm db:setup
# Run migrations only: docker run --env DATABASE_URL=xxx keeperhub-migrator pnpm db:migrate
# Run seed only: docker run --env DATABASE_URL=xxx keeperhub-migrator pnpm db:seed

# Stage 2.7a: Scheduler Dependencies (minimal deps for scheduler scripts)
FROM node:25-alpine AS scheduler-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy scheduler-specific package.json with minimal dependencies
COPY scheduler/package.json ./

# Install only scheduler dependencies (production only) with cache mount
RUN --mount=type=cache,id=pnpm-scheduler,target=/root/.local/share/pnpm/store \
    pnpm install --prod

# Stage 2.7b: Scheduler stage (for schedule dispatcher and job spawner)
FROM node:25-alpine AS scheduler
WORKDIR /app
RUN npm install -g tsx
COPY --from=deps /etc/ssl/certs/rds-combined-ca-bundle.pem /etc/ssl/certs/rds-combined-ca-bundle.pem

# Copy ONLY scheduler dependencies (not full node_modules - saves ~1.7GB)
COPY --from=scheduler-deps /app/node_modules ./node_modules
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
# Run dispatcher: docker run keeperhub-scheduler tsx scripts/schedule-dispatcher.ts
# Run job spawner: docker run keeperhub-scheduler tsx scripts/job-spawner.ts

# Stage 2.8: Workflow Runner stage (for executing workflows in K8s Jobs)
FROM node:25-alpine AS workflow-runner
WORKDIR /app
RUN npm install -g pnpm tsx
COPY --from=deps /etc/ssl/certs/rds-combined-ca-bundle.pem /etc/ssl/certs/rds-combined-ca-bundle.pem

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
# We need to replace it in the .pnpm folder where the actual package lives
RUN find /app/node_modules -path "*server-only*/index.js" | while read f; do echo 'module.exports = {};' > "$f"; done

ENV NODE_ENV=production

# This stage runs inside K8s Jobs to execute individual workflows
# Environment variables are passed by the job-spawner:
#   WORKFLOW_ID, EXECUTION_ID, SCHEDULE_ID, WORKFLOW_INPUT, DATABASE_URL
#
# Build with: docker build --target workflow-runner -t keeperhub-runner .
CMD ["tsx", "scripts/workflow-runner.ts"]

# Stage 3: Runner (main Next.js app)
FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /etc/ssl/certs/rds-combined-ca-bundle.pem /etc/ssl/certs/rds-combined-ca-bundle.pem

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy OG image fonts for server-side image generation
COPY --from=source --chown=nextjs:nodejs /app/keeperhub/api/og/fonts ./keeperhub/api/og/fonts

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server.js"]
