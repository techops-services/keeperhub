/**
 * Seed script for local testing of the decode-calldata plugin.
 * Creates a test user, org, and a workflow with a decode-calldata step.
 *
 * Usage: pnpm tsx scripts/seed-test-workflow.ts
 */

import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "../lib/db/connection-utils";
import {
  member,
  organization,
  sessions,
  users,
  workflows,
} from "../lib/db/schema";
import { generateId } from "../lib/utils/id";

const connectionString = getDatabaseUrl();
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const USER_ID = "test-user-001";
const ORG_ID = "test-org-001";
const SESSION_TOKEN = "test-session-token";
const WORKFLOW_ID = generateId();

// ERC-20 transfer(address,uint256) calldata for testing
const SAMPLE_CALLDATA =
  "0xa9059cbb000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000003d0900";

async function seed(): Promise<void> {
  console.log("Seeding test data for decode-calldata plugin...\n");

  const now = new Date();

  // 1. User
  await db
    .insert(users)
    .values({
      id: USER_ID,
      name: "Test User",
      email: "test@keeperhub.local",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  console.log("  + User: test@keeperhub.local");

  // 2. Session (so the UI works)
  await db
    .insert(sessions)
    .values({
      id: generateId(),
      token: SESSION_TOKEN,
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  console.log("  + Session created (30 day expiry)");

  // 3. Organization
  await db
    .insert(organization)
    .values({
      id: ORG_ID,
      name: "Test Org",
      slug: "test-org",
      createdAt: now,
    })
    .onConflictDoNothing();
  console.log("  + Organization: Test Org");

  // 4. Membership
  await db
    .insert(member)
    .values({
      id: generateId(),
      organizationId: ORG_ID,
      userId: USER_ID,
      role: "owner",
      createdAt: now,
    })
    .onConflictDoNothing();
  console.log("  + Member: owner role");

  // 5. Workflow with decode-calldata step
  const triggerNodeId = "trigger-1";
  const decodeNodeId = "decode-1";

  const nodes = [
    {
      id: triggerNodeId,
      type: "trigger",
      position: { x: 250, y: 50 },
      data: {
        label: "Manual Trigger",
        type: "trigger",
        config: { triggerType: "manual" },
        status: "idle",
        enabled: true,
      },
    },
    {
      id: decodeNodeId,
      type: "action",
      position: { x: 250, y: 250 },
      data: {
        label: "Decode Calldata",
        description: "Decode raw transaction calldata",
        type: "action",
        config: {
          actionType: "web3/decode-calldata",
          calldata: SAMPLE_CALLDATA,
          contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          network: "ethereum",
        },
        status: "idle",
        enabled: true,
      },
    },
  ];

  const edges = [
    {
      id: `${triggerNodeId}-${decodeNodeId}`,
      source: triggerNodeId,
      target: decodeNodeId,
    },
  ];

  await db
    .insert(workflows)
    .values({
      id: WORKFLOW_ID,
      name: "Test: Decode USDT Transfer Calldata",
      description:
        "Decodes an ERC-20 transfer() call to USDT contract on Ethereum mainnet",
      userId: USER_ID,
      organizationId: ORG_ID,
      nodes,
      edges,
      visibility: "private",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  console.log(`  + Workflow: ${WORKFLOW_ID}`);

  console.log("\nDone! Test workflow created.");
  console.log(
    `\nOpen in browser: http://localhost:3000/workflows/${WORKFLOW_ID}`
  );

  await client.end();
  process.exit(0);
}

seed().catch(async (err: unknown) => {
  console.error("Seed failed:", err);
  await client.end();
  process.exit(1);
});
