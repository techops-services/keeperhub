# SSL + world-postgres: SELF_SIGNED_CERT_IN_CHAIN

## Problem

After deploying `@workflow/world-postgres` to staging, the app fails to start:

```
[ERROR] Failed to prepare server Error: An error occurred while loading instrumentation hook: self-signed certificate in certificate chain
  code: 'SELF_SIGNED_CERT_IN_CHAIN'
  at async Module.s (.next/server/chunks/_f5dc613a._.js:2:852)
```

The error occurs during `world.start()` in `instrumentation.ts`, which initializes pg-boss and opens PostgreSQL connections at server startup.

## Root Cause

Staging and production databases are **AWS RDS** instances (provisioned via `terraform-aws-modules/rds/aws` in `infra/infrastructure/staging/keeper-app/main.tf`). RDS uses certificates signed by Amazon's own CA chain, which is not in Node.js's default trust store.

When `pg-boss` (which uses the `pg` / node-postgres library) connects eagerly during `world.start()`, Node.js validates the RDS certificate chain, doesn't recognise Amazon's root CA, and rejects the connection with `SELF_SIGNED_CERT_IN_CHAIN`.

> **Correction**: This doc originally attributed the error to CNPG self-signed certificates. That was incorrect — staging/production use RDS, not CNPG. CNPG is only used in PR environments (where SSL is not enforced, so no error occurs).

## Database Architecture

| Environment | Database | Provisioned By | SSL |
|---|---|---|---|
| PR environments | CNPG (in-cluster Postgres pods) | Helm template per-PR | Not enforced (plain connection strings) |
| Staging | AWS RDS (`db.t3.small`) | Terraform (`infra/infrastructure/staging/`) | Amazon RDS CA chain |
| Production | AWS RDS | Terraform (`infra/infrastructure/prod/`) | Amazon RDS CA chain |

Connection URLs for staging/production come from AWS Parameter Store:

| Environment | Parameter |
|---|---|
| Staging | `/eks/maker-staging/keeperhub/db-url` |
| Production | `/eks/maker-prod/keeperhub/db-url` |

## Why PR Environments Work

PR environments construct the DATABASE_URL inline in the Helm values template:

```
postgresql://keeperhub:${DB_PASSWORD}@keeperhub-pr-${PR_NUMBER}-db-rw.pr-${PR_NUMBER}.svc.cluster.local:5432/keeperhub
```

This connects to a CNPG pod within the K8s cluster. SSL is not enforced, so the `pg` library connects without certificate validation.

## Why Staging/Production Fail

RDS enforces SSL with certificates signed by Amazon's CA. When `pg-boss` connects:

1. SSL is negotiated with the RDS instance
2. Node.js TLS validates the certificate chain
3. Amazon's root CA is not in Node.js's default trust store
4. Node.js rejects it: `SELF_SIGNED_CERT_IN_CHAIN`

## Why Drizzle ORM Doesn't Hit This

The existing Drizzle ORM connection (`lib/db/index.ts`) uses the same DATABASE_URL but doesn't fail because:

- Drizzle uses `postgres.js` v3 (the `postgres` npm package), not `pg` (node-postgres)
- The connection is **lazy** — it only connects on first database query, after the server is running
- `postgres.js` v3 may handle SSL negotiation differently from `pg`

In contrast, `world.start()` runs during the instrumentation hook (before the HTTP server starts) and pg-boss connects **eagerly**.

## Connection Architecture

```
instrumentation.ts
  world.start()
    pg-boss (uses `pg` library)      --> RDS SSL --> SELF_SIGNED_CERT_IN_CHAIN
    postgres.js v3 (direct queries)   --> RDS SSL --> may also fail

lib/db/index.ts
  postgres.js v3 (Drizzle ORM)       --> RDS SSL --> works (different SSL handling or lazy)
```

Both connect to the same RDS instance, same URL. The difference is the driver (`pg` vs `postgres.js`) and timing (eager vs lazy).

## Solution: NODE_EXTRA_CA_CERTS with RDS CA Bundle

Since staging/production use RDS, the fix is to add Amazon's RDS CA certificate chain to Node.js's trust store.

### Implementation

**Dockerfile** — download the RDS CA bundle during build:

```dockerfile
RUN wget -O /etc/ssl/certs/rds-combined-ca-bundle.pem \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

The cert is copied to all Docker stages (migrator, scheduler, workflow-runner, runner).

**Helm values** (staging + production only) — tell Node.js to trust it:

```yaml
NODE_EXTRA_CA_CERTS:
  type: kv
  value: "/etc/ssl/certs/rds-combined-ca-bundle.pem"
```

PR environments do **not** set `NODE_EXTRA_CA_CERTS` since they use CNPG without SSL enforcement.

### Why This Works

- `NODE_EXTRA_CA_CERTS` appends certificates to Node.js's default trust store (doesn't replace it)
- The RDS bundle contains Amazon's full CA chain, so RDS certificates validate successfully
- External HTTPS connections (OpenAI, Sentry, etc.) continue to work normally — they use public CAs already in the default trust store
- No security tradeoffs — connections are encrypted AND verified against a known CA
