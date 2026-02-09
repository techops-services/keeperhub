import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleDatabaseTest, handlePluginTest } from "@/lib/db/test-connection";
import type {
  IntegrationConfig,
  IntegrationType,
} from "@/lib/types/integration";

export type { TestConnectionResult } from "@/lib/db/test-connection";

export type TestConnectionRequest = {
  type: IntegrationType;
  config: IntegrationConfig;
};

/**
 * POST /api/integrations/test
 * Test connection credentials without saving
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TestConnectionRequest = await request.json();

    if (!(body.type && body.config)) {
      return NextResponse.json(
        { error: "Type and config are required" },
        { status: 400 }
      );
    }

    if (body.type === "database") {
      const result = await handleDatabaseTest(body.config);
      return NextResponse.json(result);
    }

    const result = await handlePluginTest(body.type, body.config);
    if (
      result.message === "Invalid integration type" ||
      result.message === "Integration does not support testing"
    ) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test connection";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
