Spin up a complete local development environment for KeeperHub. Follow these steps in order, checking each prerequisite before proceeding.

## 1. Prerequisites Check

Verify Docker is running:
```bash
docker info > /dev/null 2>&1
```
If Docker is not running, tell the user to start Docker Desktop and try again.

Check if port 5432 is already in use:
```bash
lsof -i :5432
```
If something is already on 5432, check if it's a keeperhub-postgres container. If it is, reuse it. If it's something else, warn the user.

## 2. Start Postgres

Check for an existing keeperhub-postgres container:
```bash
docker ps -a --filter "name=keeperhub-postgres" --format "{{.Names}} {{.Status}}"
```

- If running: skip, reuse it
- If stopped: `docker start keeperhub-postgres`
- If not found: create it:
```bash
docker run -d --name keeperhub-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workflow \
  -p 5432:5432 \
  postgres:16-alpine
```

Wait for Postgres to be ready:
```bash
sleep 3 && docker exec keeperhub-postgres pg_isready
```

## 3. Configure Environment

Read the current `.env` file. Check if `DATABASE_URL` and `BETTER_AUTH_SECRET` are already set.

If NOT set, add them at the top of `.env`:
```
DATABASE_URL="postgres://postgres:postgres@localhost:5432/workflow"
BETTER_AUTH_SECRET="local-dev-secret-change-me"
BETTER_AUTH_URL="http://localhost:3000"
```

Do NOT overwrite existing values. Do NOT remove any existing env vars.

## 4. Install Dependencies & Push Schema

```bash
pnpm install
pnpm db:push
pnpm db:seed-chains
pnpm discover-plugins
```

## 5. Create Test User

Use the Better Auth sign-up API to create a user with a proper password hash:
```bash
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@keeperhub.local","password":"testpass123","name":"Dev User"}'
```

NOTE: The dev server must be running for this step. If it's not running yet, start it first in the background with `pnpm dev`, wait for it to be ready, then create the user.

If the user already exists, that's fine -- skip this step.

After creating the user, mark email as verified and get the user ID:
```bash
docker exec keeperhub-postgres psql -U postgres -d workflow -c "
  UPDATE users SET email_verified = true WHERE email = 'dev@keeperhub.local';
  SELECT id FROM users WHERE email = 'dev@keeperhub.local';
"
```

## 6. Create Test Organization

Using the user ID from step 5:
```bash
docker exec keeperhub-postgres psql -U postgres -d workflow -c "
  INSERT INTO organization (id, name, slug, created_at)
  VALUES ('test-org-001', 'Test Org', 'test-org', NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO member (id, organization_id, user_id, role, created_at)
  VALUES ('mem-001', 'test-org-001', '<USER_ID>', 'owner', NOW())
  ON CONFLICT DO NOTHING;

  UPDATE sessions SET active_organization_id = 'test-org-001'
  WHERE user_id = '<USER_ID>';
"
```

Replace `<USER_ID>` with the actual user ID from step 5.

## 7. Start Dev Server (if not already running)

```bash
pnpm dev
```

Run in background and wait for "Ready" message.

## 8. Present Summary

After everything is set up, present the user with this information:

```
Local Dev Environment Ready

  Postgres:  localhost:5432 (Docker: keeperhub-postgres)
  App:       http://localhost:3000

  Sign in:
    Email:    dev@keeperhub.local
    Password: testpass123

  Organization: Test Org (test-org-001)

  Useful commands:
    pnpm dev           - Start dev server
    pnpm db:studio     - Open Drizzle Studio (DB browser)
    pnpm db:push       - Push schema changes
    pnpm discover-plugins - Re-register plugins after changes
```

## Important Notes

- Do NOT commit `.env` changes -- the file is gitignored
- Do NOT create documentation files
- If any step fails, stop and tell the user what went wrong with the specific error
- The seed script at `scripts/seed-test-workflow.ts` can be used separately to create test workflows
