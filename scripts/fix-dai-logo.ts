/**
 * Quick fix for DAI logo URL
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { supportedTokens } from "../keeperhub/db/schema-extensions";

const CORRECT_DAI_LOGO =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png";

async function fix() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("Before update:");
  const before = await db
    .select({
      symbol: supportedTokens.symbol,
      logoUrl: supportedTokens.logoUrl,
    })
    .from(supportedTokens)
    .where(eq(supportedTokens.symbol, "DAI"));
  console.log(before);

  console.log("\nUpdating DAI logos...");
  await db
    .update(supportedTokens)
    .set({ logoUrl: CORRECT_DAI_LOGO })
    .where(eq(supportedTokens.symbol, "DAI"));

  console.log("\nAfter update:");
  const after = await db
    .select({
      symbol: supportedTokens.symbol,
      logoUrl: supportedTokens.logoUrl,
    })
    .from(supportedTokens)
    .where(eq(supportedTokens.symbol, "DAI"));
  console.log(after);

  await client.end();
}

fix().catch(console.error);
