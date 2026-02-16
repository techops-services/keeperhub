/**
 * Test Endpoint: Trigger All Error Types
 *
 * This endpoint triggers all error categories from the unified logging system
 * to generate metrics data for Prometheus/Grafana dashboard development.
 *
 * WARNING: This endpoint should ONLY be enabled in development/staging environments.
 * DO NOT enable in production.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/test/trigger-errors
 *   curl -X POST http://localhost:3000/api/test/trigger-errors?category=validation
 *   curl -X POST http://localhost:3000/api/test/trigger-errors?count=10
 */

import { NextResponse } from "next/server";
import {
  ErrorCategory,
  logUserError,
  logSystemError,
} from "@/keeperhub/lib/logging";

type ErrorTrigger = {
  name: string;
  category: ErrorCategory;
  isSystem: boolean;
  trigger: () => void;
};

const errorTriggers: ErrorTrigger[] = [
  // User-caused errors
  {
    name: "validation",
    category: ErrorCategory.VALIDATION,
    isSystem: false,
    trigger: () => {
      logUserError(
        ErrorCategory.VALIDATION,
        "[Test] Invalid address format",
        new Error("Test validation error"),
        {
          plugin_name: "web3",
          action_name: "check-balance",
        }
      );
    },
  },
  {
    name: "configuration",
    category: ErrorCategory.CONFIGURATION,
    isSystem: false,
    trigger: () => {
      logUserError(
        ErrorCategory.CONFIGURATION,
        "[Test] Missing API key in integration",
        new Error("Test configuration error"),
        {
          integration_id: "test-123",
        }
      );
    },
  },
  {
    name: "external_service",
    category: ErrorCategory.EXTERNAL_SERVICE,
    isSystem: false,
    trigger: () => {
      logUserError(
        ErrorCategory.EXTERNAL_SERVICE,
        "[Etherscan] API rate limit exceeded",
        new Error("Test external service error"),
        {
          service: "etherscan",
          status_code: "429",
        }
      );
      logUserError(
        ErrorCategory.EXTERNAL_SERVICE,
        "[SendGrid] Email delivery failed",
        new Error("Test SendGrid error"),
        {
          service: "sendgrid",
          status_code: "503",
        }
      );
      logUserError(
        ErrorCategory.EXTERNAL_SERVICE,
        "[Discord] Webhook timeout",
        new Error("Test Discord error"),
        {
          service: "discord",
        }
      );
    },
  },
  {
    name: "network_rpc",
    category: ErrorCategory.NETWORK_RPC,
    isSystem: false,
    trigger: () => {
      logUserError(
        ErrorCategory.NETWORK_RPC,
        "[RPC] Connection timeout to Ethereum node",
        new Error("Test RPC error"),
        {
          chain_id: "1",
        }
      );
      logUserError(
        ErrorCategory.NETWORK_RPC,
        "[RPC] Failed to fetch balance",
        new Error("Test balance fetch error"),
        {
          chain_id: "137",
        }
      );
    },
  },
  {
    name: "transaction",
    category: ErrorCategory.TRANSACTION,
    isSystem: false,
    trigger: () => {
      logUserError(
        ErrorCategory.TRANSACTION,
        "[Transaction] Gas estimation failed",
        new Error("Test transaction error"),
        {
          chain_id: "1",
        }
      );
      logUserError(
        ErrorCategory.TRANSACTION,
        "[Transaction] Insufficient funds",
        new Error("Test insufficient funds"),
        {
          chain_id: "137",
        }
      );
    },
  },

  // System-caused errors
  {
    name: "database",
    category: ErrorCategory.DATABASE,
    isSystem: true,
    trigger: () => {
      logSystemError(
        ErrorCategory.DATABASE,
        "[DB] Connection pool exhausted",
        new Error("Test database error"),
        {
          table: "workflows",
        }
      );
      logSystemError(
        ErrorCategory.DATABASE,
        "[DB] Query timeout",
        new Error("Test query timeout"),
        {
          table: "executions",
        }
      );
    },
  },
  {
    name: "auth",
    category: ErrorCategory.AUTH,
    isSystem: true,
    trigger: () => {
      logSystemError(
        ErrorCategory.AUTH,
        "[Auth] Session validation failed",
        new Error("Test auth error"),
        {
          endpoint: "/api/workflows",
        }
      );
    },
  },
  {
    name: "infrastructure",
    category: ErrorCategory.INFRASTRUCTURE,
    isSystem: true,
    trigger: () => {
      logSystemError(
        ErrorCategory.INFRASTRUCTURE,
        "[Para] PARA_API_KEY not configured",
        new Error("Test infrastructure error"),
        {
          component: "para-service",
        }
      );
      logSystemError(
        ErrorCategory.INFRASTRUCTURE,
        "[Events] Service unreachable",
        new Error("Test service unreachable"),
        {
          component: "events-service",
        }
      );
    },
  },
  {
    name: "workflow_engine",
    category: ErrorCategory.WORKFLOW_ENGINE,
    isSystem: true,
    trigger: () => {
      logSystemError(
        ErrorCategory.WORKFLOW_ENGINE,
        "[Workflow] Step execution timeout",
        new Error("Test workflow error"),
        {
          workflow_id: "test-wf-123",
          execution_id: "test-ex-456",
        }
      );
    },
  },
];

export async function POST(request: Request): Promise<NextResponse> {
  // Security: Only enable in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test endpoints disabled in production" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category");
  const countParam = searchParams.get("count");
  const count = countParam ? Number.parseInt(countParam, 10) : 1;

  if (count < 1 || count > 100) {
    return NextResponse.json(
      { error: "Count must be between 1 and 100" },
      { status: 400 }
    );
  }

  const triggersToRun = categoryFilter
    ? errorTriggers.filter((t) => t.name === categoryFilter)
    : errorTriggers;

  if (triggersToRun.length === 0) {
    return NextResponse.json(
      {
        error: `Unknown category: ${categoryFilter}`,
        available: errorTriggers.map((t) => t.name),
      },
      { status: 400 }
    );
  }

  const triggered: string[] = [];

  // Trigger errors multiple times based on count
  for (let i = 0; i < count; i++) {
    for (const trigger of triggersToRun) {
      trigger.trigger();
      if (i === 0) {
        triggered.push(trigger.name);
      }
    }
  }

  return NextResponse.json({
    success: true,
    triggered,
    count,
    message: `Triggered ${triggered.length} error categories ${count} time(s) each`,
    note: "Check /api/metrics to see the incremented counters",
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: "/api/test/trigger-errors",
    method: "POST",
    description:
      "Triggers all error categories for metrics testing and Grafana dashboard development",
    security: "Only enabled in non-production environments",
    usage: {
      "Trigger all errors once": "POST /api/test/trigger-errors",
      "Trigger specific category": "POST /api/test/trigger-errors?category=validation",
      "Trigger multiple times": "POST /api/test/trigger-errors?count=10",
      "Combine filters": "POST /api/test/trigger-errors?category=external_service&count=20",
    },
    categories: errorTriggers.map((t) => ({
      name: t.name,
      category: t.category,
      type: t.isSystem ? "system" : "user",
    })),
  });
}
