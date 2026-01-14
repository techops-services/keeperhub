import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationApiKeys } from "@/lib/db/schema";
// end keeperhub code //

// DELETE - Revoke an API key
export async function DELETE(
  request: Request,
  context: { params: Promise<{ keyId: string }> }
) {
  try {
    const { keyId } = await context.params;
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

    // Revoke the key (soft delete) - only if it belongs to the organization
    const result = await db
      .update(organizationApiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(organizationApiKeys.id, keyId),
          eq(organizationApiKeys.organizationId, activeOrgId)
        )
      )
      .returning({ id: organizationApiKeys.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    console.log(
      `[API Keys] Revoked API key ${keyId} for organization ${activeOrgId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Keys] Failed to revoke API key:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to revoke API key",
      },
      { status: 500 }
    );
  }
}
