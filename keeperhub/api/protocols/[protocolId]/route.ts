import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ protocolId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { protocolId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    const [updated] = await db
      .update(protocols)
      .set(updateData)
      .where(eq(protocols.id, protocolId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Protocol not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Protocols] Failed to update protocol:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update protocol",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ protocolId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const { protocolId } = await context.params;

    const [deleted] = await db
      .delete(protocols)
      .where(eq(protocols.id, protocolId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Protocol not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Protocols] Failed to delete protocol:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete protocol",
      },
      { status: 500 }
    );
  }
}
