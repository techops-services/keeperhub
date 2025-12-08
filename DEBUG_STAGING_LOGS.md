# Staging Debug Logs - Session Error Investigation

## Error Description
Getting 500 errors on `/api/auth/get-session` and `/api/workflows` in staging but working locally.

## Added Logging

### 1. Database Connection (`lib/db/index.ts`)
Look for these logs:
```
[Database] Initializing connection
[Database] Migration client created
[Database] Query client created and drizzle initialized
```

**If you see an error here**, the DATABASE_URL is likely misconfigured or the database is unreachable.

### 2. Auth Initialization (`lib/auth.ts`)
Look for these logs:
```
[Auth] Environment variables: { BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL, NODE_ENV }
[Auth] Using BETTER_AUTH_URL: <url>  (or NEXT_PUBLIC_APP_URL or VERCEL_URL)
[Auth] Initializing better-auth with baseURL: <url>
[Auth] Database adapter config: { provider: "pg", hasDb: true }
[Auth] Social providers config: { github: {...}, google: {...} }
[Auth] Plugins count: <number>
[Auth] better-auth initialized successfully
```

**Key things to check:**
- Is the baseURL correct? Should be `https://workflows-staging.keeperhub.com`
- Is `hasDb` true?
- Did initialization complete successfully?

### 3. Auth Route Handler (`app/api/auth/[...all]/route.ts`)
Look for these logs:
```
[Auth Route] Initializing auth handlers
[Auth Route] Handlers created successfully
[Auth Route] GET request: <url>
[Auth Route] GET response status: <status>
```

**If you see:**
- `[Auth Route] GET error:` - This shows the actual error from better-auth
- Check if handlers were created successfully

### 4. Workflows API (`app/api/workflows/route.ts`)
Look for these logs:
```
[Workflows API] GET request received
[Workflows API] Attempting to get session...
[Workflows API] Session result: { hasSession, hasUser, userId }
[Workflows API] Querying workflows for user: <userId>
[Workflows API] Found workflows: <count>
[Workflows API] Returning workflows successfully
```

**If you see:**
- `[Workflows API] Error occurred:` - This will show the error message and stack trace

## Most Likely Issues

### 1. Database Connection
The postgres connection string might be wrong or the database might be unreachable from Vercel.

**Check:**
- Is `DATABASE_URL` set in Vercel environment variables?
- Can Vercel reach the database? (Check firewall/VPC settings)

### 2. Base URL Misconfiguration
The auth baseURL might not match the actual deployment URL.

**Check:**
- Set `BETTER_AUTH_URL=https://workflows-staging.keeperhub.com` in Vercel env vars
- Or ensure `NEXT_PUBLIC_APP_URL` is set correctly
- Or ensure `VERCEL_URL` is being detected properly

### 3. Plugin/Import Error
Based on the recent revert that removed clerk/webflow plugins, there might be:
- Stale build cache trying to import removed modules
- Database tables that better-auth is trying to query that don't exist

**Try:**
- Clear Vercel build cache and redeploy
- Check if database schema is up to date

## How to View Logs

### Vercel Dashboard
1. Go to https://vercel.com/
2. Select your project
3. Click on the staging deployment
4. Go to "Functions" tab → Click any function → See logs
5. Or go to "Logs" tab for all logs

### Vercel CLI
```bash
vercel logs workflows-staging.keeperhub.com --follow
```

## Next Steps

1. Deploy this branch to staging
2. Try to load the site
3. Check the logs for the patterns above
4. Share the error messages from the logs

The logs will tell us exactly where the initialization is failing.
