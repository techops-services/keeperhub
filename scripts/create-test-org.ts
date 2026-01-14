import crypto from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}
const client = postgres(databaseUrl);

async function createTestOrg() {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  // Create user
  await client`
    INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
    VALUES (${userId}, 'Test User', 'test@keeperhub.local', true, NOW(), NOW())
  `;
  console.log("Created user:", userId);

  // Create organization
  await client`
    INSERT INTO organization (id, name, slug, logo, created_at, metadata)
    VALUES (${orgId}, 'Test Organization', 'test-org', NULL, NOW(), '{}')
  `;
  console.log("Created organization:", orgId);

  // Add user as owner
  await client`
    INSERT INTO member (id, organization_id, user_id, role, created_at)
    VALUES (${memberId}, ${orgId}, ${userId}, 'owner', NOW())
  `;
  console.log("Added user as owner");

  // Now create API key
  const randomBytes = crypto.randomBytes(24);
  const key = `kh_${randomBytes.toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 8);
  const keyId = crypto.randomUUID();

  await client`
    INSERT INTO organization_api_keys (id, organization_id, name, key_hash, key_prefix, created_by, created_at)
    VALUES (${keyId}, ${orgId}, 'MCP Test Key', ${keyHash}, ${keyPrefix}, ${userId}, NOW())
  `;

  console.log("\n=== Setup Complete ===");
  console.log("API Key (save this, shown only once):", key);
  console.log("Organization ID:", orgId);

  await client.end();
}

createTestOrg().catch(console.error);
