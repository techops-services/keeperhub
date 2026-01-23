import { config } from "dotenv";
import type { Config } from "drizzle-kit";
import { getDatabaseUrl } from "./lib/db/connection-utils";

config();

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
} satisfies Config;
