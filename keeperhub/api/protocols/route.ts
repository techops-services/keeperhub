import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/keeperhub/lib/api-key-auth";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { protocols, workflows } from "@/lib/db/schema";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const apiKeyAuth = await authenticateApiKey(request);
    let organizationId: string | null;

    if (apiKeyAuth.authenticated) {
      organizationId = apiKeyAuth.organizationId || null;
    } else {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const context = await getOrgContext();
      organizationId = context.organization?.id || null;
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const orgProtocols = await db
      .select({
        id: protocols.id,
        name: protocols.name,
        organizationId: protocols.organizationId,
        userId: protocols.userId,
        createdAt: protocols.createdAt,
        updatedAt: protocols.updatedAt,
        workflowCount: count(workflows.id),
      })
      .from(protocols)
      .leftJoin(workflows, eq(workflows.protocolId, protocols.id))
      .where(eq(protocols.organizationId, organizationId))
      .groupBy(protocols.id)
      .orderBy(protocols.name);

    const response = orgProtocols.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Protocols] Failed to list protocols:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list protocols",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getOrgContext();
    const organizationId = context.organization?.id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [newProtocol] = await db
      .insert(protocols)
      .values({
        name,
        organizationId,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json(
      {
        ...newProtocol,
        workflowCount: 0,
        createdAt: newProtocol.createdAt.toISOString(),
        updatedAt: newProtocol.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Protocols] Failed to create protocol:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create protocol",
      },
      { status: 500 }
    );
  }
}
