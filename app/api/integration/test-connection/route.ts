import { LinearClient } from "@linear/sdk";
import { WebClient } from "@slack/web-api";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { Resend } from "resend";
import { api } from "@/lib/api-client";
import { auth } from "@/lib/auth";

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId, integrationType } = body;

    if (!(workflowId && integrationType)) {
      return NextResponse.json(
        { error: "workflowId and integrationType are required" },
        { status: 400 }
      );
    }

    let result: TestConnectionResult;

    switch (integrationType) {
      case "linear":
        result = await testLinearConnection(workflowId);
        break;
      case "slack":
        result = await testSlackConnection(workflowId);
        break;
      case "resend":
        result = await testResendConnection(workflowId);
        break;
      case "aiGateway":
        result = await testAiGatewayConnection(workflowId);
        break;
      case "database":
        result = await testDatabaseConnection(workflowId);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid integration type" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test connection:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}

async function testLinearConnection(
  workflowId: string
): Promise<TestConnectionResult> {
  try {
    const integrations = await api.vercelProject.getIntegrations(workflowId);
    const apiKey = integrations.linearApiKey;

    if (!apiKey) {
      return {
        status: "error",
        message: "Linear API key is not configured for this workflow",
      };
    }

    const client = new LinearClient({ apiKey });
    const viewer = await client.viewer;

    return {
      status: "success",
      message: `Connected successfully as ${viewer.name}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testSlackConnection(
  workflowId: string
): Promise<TestConnectionResult> {
  try {
    const integrations = await api.vercelProject.getIntegrations(workflowId);
    const apiKey = integrations.slackApiKey;

    if (!apiKey) {
      return {
        status: "error",
        message: "Slack bot token is not configured for this workflow",
      };
    }

    const client = new WebClient(apiKey);
    const slackAuth = await client.auth.test();

    if (!slackAuth.ok) {
      return {
        status: "error",
        message: slackAuth.error || "Authentication failed",
      };
    }

    return {
      status: "success",
      message: `Connected successfully to ${slackAuth.team || "workspace"}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testResendConnection(
  workflowId: string
): Promise<TestConnectionResult> {
  try {
    const integrations = await api.vercelProject.getIntegrations(workflowId);
    const apiKey = integrations.resendApiKey;

    if (!apiKey) {
      return {
        status: "error",
        message: "Resend API key is not configured for this workflow",
      };
    }

    const resend = new Resend(apiKey);
    const domains = await resend.domains.list();

    if (!domains.data) {
      return {
        status: "error",
        message: "Failed to fetch domains",
      };
    }

    const domainCount = Array.isArray(domains.data)
      ? domains.data.length
      : "some";

    return {
      status: "success",
      message: `Connected successfully. Found ${domainCount} domain(s)`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testAiGatewayConnection(
  workflowId: string
): Promise<TestConnectionResult> {
  try {
    const integrations = await api.vercelProject.getIntegrations(workflowId);
    const apiKey = integrations.aiGatewayApiKey;

    if (!apiKey) {
      return {
        status: "error",
        message: "AI Gateway API key is not configured for this workflow",
      };
    }

    // Test the AI Gateway by making a simple request
    const response = await fetch("https://gateway.ai.cloudflare.com/v1/test", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Connection failed: ${response.statusText}`,
      };
    }

    return {
      status: "success",
      message: "Connected successfully",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testDatabaseConnection(
  workflowId: string
): Promise<TestConnectionResult> {
  let connection: postgres.Sql | null = null;

  try {
    const integrations = await api.vercelProject.getIntegrations(workflowId);
    const databaseUrl = integrations.databaseUrl;

    if (!databaseUrl) {
      return {
        status: "error",
        message: "Database URL is not configured for this workflow",
      };
    }

    // Create a connection
    connection = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    });

    // Try a simple query
    await connection`SELECT 1`;

    return {
      status: "success",
      message: "Connected successfully",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  } finally {
    // Clean up the connection
    if (connection) {
      await connection.end();
    }
  }
}
