import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, genericOAuth } from "better-auth/plugins";
import { db } from "./db";
import {
  accounts,
  sessions,
  users,
  verifications,
  workflowExecutionLogs,
  workflowExecutions,
  workflowExecutionsRelations,
  workflows,
} from "./db/schema";

// Construct schema object for drizzle adapter
const schema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  workflows,
  workflowExecutions,
  workflowExecutionLogs,
  workflowExecutionsRelations,
};

// Determine the base URL for authentication
// This supports Vercel Preview deployments with dynamic URLs
function getBaseURL() {
  // Priority 1: Explicit BETTER_AUTH_URL (set manually for production/dev)
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  // Priority 2: NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Priority 3: Check if we're on Vercel (for preview deployments)
  if (process.env.VERCEL_URL) {
    // VERCEL_URL doesn't include protocol, so add it
    // Use https for Vercel deployments (both production and preview)
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback: Local development
  return "http://localhost:3000";
}

// Build plugins array conditionally
const plugins = [
  anonymous(),
  ...(process.env.VERCEL_CLIENT_ID
    ? [
        genericOAuth({
          config: [
            {
              providerId: "vercel",
              clientId: process.env.VERCEL_CLIENT_ID,
              clientSecret: process.env.VERCEL_CLIENT_SECRET || "",
              authorizationUrl: "https://vercel.com/oauth/authorize",
              tokenUrl: "https://vercel.com/oauth/access_token",
              userInfoUrl: "https://api.vercel.com/v2/user",
              scopes: [],
              discoveryUrl: undefined,
              pkce: false,
              getUserInfo: async (tokens) => {
                const response = await fetch("https://api.vercel.com/v2/user", {
                  headers: {
                    Authorization: `Bearer ${tokens.accessToken}`,
                  },
                });
                const data = await response.json();
                return {
                  id: data.user.id,
                  email: data.user.email,
                  name: data.user.name,
                  emailVerified: true,
                  image: `https://vercel.com/api/www/avatar/?u=${data.user.username}`,
                };
              },
            },
          ],
        }),
      ]
    : []),
];

export const auth = betterAuth({
  baseURL: getBaseURL(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
  },
  plugins,
});
