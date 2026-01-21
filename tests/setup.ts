import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { vi } from "vitest";

// Load .env file and expand variables
expand(config());

// Set default environment variables (only if not already set)
// This allows E2E tests to override with real infrastructure
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5433/keeperhub";
process.env.AWS_ENDPOINT_URL ??= "http://localhost:4566";
process.env.AWS_REGION ??= "us-east-1";
process.env.AWS_ACCESS_KEY_ID ??= "test";
process.env.AWS_SECRET_ACCESS_KEY ??= "test";
process.env.SQS_QUEUE_URL ??=
  "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/keeperhub-workflow-queue";
process.env.KEEPERHUB_URL ??= "http://localhost:3000";

// Global test utilities
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      workflows: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workflowSchedules: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workflowExecutions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));
