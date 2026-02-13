import { NextResponse } from "next/server";
// start custom keeperhub code //
import { logDatabaseError } from "@/keeperhub/lib/logging";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import {
  deleteIntegration,
  getIntegration,
  stripDatabaseSecrets,
  updateIntegration,
} from "@/lib/db/integrations";
import type { IntegrationConfig } from "@/lib/types/integration";
// end keeperhub code //

export type GetIntegrationResponse = {
  id: string;
  name: string;
  type: string;
  config: IntegrationConfig;
  createdAt: string;
  updatedAt: string;
};

export type UpdateIntegrationRequest = {
  name?: string;
  config?: IntegrationConfig;
};

/**
 * GET /api/integrations/[integrationId]
 * Get a single integration with decrypted config
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id || null;
    // end keeperhub code //

    const integration = await getIntegration(
      integrationId,
      session.user.id,
      // start custom keeperhub code //
      organizationId
      // end keeperhub code //
    );

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // start custom keeperhub code //
    const response: GetIntegrationResponse = {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      config: stripDatabaseSecrets(integration.config, integration.type),
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    };
    // end keeperhub code //

    return NextResponse.json(response);
  } catch (error) {
    logDatabaseError("Failed to get integration", error, {
      endpoint: "/api/integrations/[integrationId]",
      operation: "get",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get integration",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/integrations/[integrationId]
 * Update an integration
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id || null;
    // end keeperhub code //

    const body: UpdateIntegrationRequest = await request.json();

    // start custom keeperhub code //
    // Fetch existing integration so updateIntegration can merge database
    // secrets without an extra DB round-trip.
    const existing =
      body.config !== undefined
        ? await getIntegration(integrationId, session.user.id, organizationId)
        : null;

    if (body.config !== undefined && !existing) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }
    // end keeperhub code //

    const integration = await updateIntegration(
      integrationId,
      session.user.id,
      body,
      // start custom keeperhub code //
      organizationId,
      existing
      // end keeperhub code //
    );

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // start custom keeperhub code //
    const response: GetIntegrationResponse = {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      config: stripDatabaseSecrets(integration.config, integration.type),
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    };
    // end keeperhub code //

    return NextResponse.json(response);
  } catch (error) {
    logDatabaseError("Failed to update integration", error, {
      endpoint: "/api/integrations/[integrationId]",
      operation: "update",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update integration",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/[integrationId]
 * Delete an integration
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id || null;
    // end keeperhub code //

    const success = await deleteIntegration(
      integrationId,
      session.user.id,
      // start custom keeperhub code //
      organizationId
      // end keeperhub code //
    );

    if (!success) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logDatabaseError("Failed to delete integration", error, {
      endpoint: "/api/integrations/[integrationId]",
      operation: "delete",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete integration",
      },
      { status: 500 }
    );
  }
}
