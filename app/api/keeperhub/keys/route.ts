import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationApiKeys } from "@/lib/db/schema";

// end keeperhub code //

// Generate a secure API key with KeeperHub prefix
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(24).toString("base64url");
  const key = `kh_${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 8); // "kh_" + first 5 chars
  return { key, hash, prefix };
}

// GET - List all API keys for the current organization
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const activeOrgId = orgContext.organization?.id;
    // end keeperhub code //

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    // List all non-revoked API keys for the organization
    const keys = await db.query.organizationApiKeys.findMany({
      where: and(
        eq(organizationApiKeys.organizationId, activeOrgId),
        isNull(organizationApiKeys.revokedAt)
      ),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return NextResponse.json(keys);
  } catch (error) {
    console.error("[API Keys] Failed to list API keys:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list API keys",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new API key for the current organization
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const activeOrgId = orgContext.organization?.id;
    // end keeperhub code //

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    // Check if user is anonymous
    const isAnonymous =
      session.user.name === "Anonymous" ||
      session.user.email?.startsWith("temp-");

    if (isAnonymous) {
      return NextResponse.json(
        { error: "Anonymous users cannot create API keys" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const name = body.name || null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    // Generate new API key
    const { key, hash, prefix } = generateApiKey();

    // Save to database
    const [newKey] = await db
      .insert(organizationApiKeys)
      .values({
        organizationId: activeOrgId,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        createdBy: session.user.id,
        expiresAt,
      })
      .returning({
        id: organizationApiKeys.id,
        name: organizationApiKeys.name,
        keyPrefix: organizationApiKeys.keyPrefix,
        createdAt: organizationApiKeys.createdAt,
        expiresAt: organizationApiKeys.expiresAt,
      });

    console.log(
      `[API Keys] Created new API key for organization ${activeOrgId}: ${newKey.id}`
    );

    // Return the full key only on creation (won't be shown again)
    return NextResponse.json({
      ...newKey,
      key, // Full key - only returned once!
    });
  } catch (error) {
    console.error("[API Keys] Failed to create API key:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create API key",
      },
      { status: 500 }
    );
  }
}
