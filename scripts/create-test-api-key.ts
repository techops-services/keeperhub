import crypto from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}
const client = postgres(databaseUrl);

async function createTestApiKey() {
  // Get first organization
  const orgs = await client`SELECT id, name FROM organization LIMIT 1`;
  if (orgs.length === 0) {
    console.error("No organizations found. Please create one first.");
    process.exit(1);
  }

  const org = orgs[0];
  console.log("Using organization:", org.name, org.id);

  // Generate API key
  const randomBytes = crypto.randomBytes(24);
  const key = `kh_${randomBytes.toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 8);
  const id = crypto.randomUUID();

  // Insert API key
  await client`
    INSERT INTO organization_api_keys (id, organization_id, name, key_hash, key_prefix, created_at)
    VALUES (${id}, ${org.id}, 'MCP Test Key', ${keyHash}, ${keyPrefix}, NOW())
  `;

  console.log("\n=== API Key Created ===");
  console.log("Key (save this, shown only once):", key);
  console.log("Prefix:", keyPrefix);
  console.log("Organization:", org.name);

  await client.end();
}

createTestApiKey().catch(console.error);
