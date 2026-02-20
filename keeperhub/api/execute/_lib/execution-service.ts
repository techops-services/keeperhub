import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { directExecutions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import type { ExecutionType } from "./types";

type CreateExecutionParams = {
  organizationId: string;
  apiKeyId: string;
  type: ExecutionType;
  network: string;
  input: Record<string, unknown>;
};

type CompleteParams = {
  transactionHash: string;
  transactionLink: string;
  gasUsedWei: string;
  output?: Record<string, unknown>;
};

export async function createExecution(
  params: CreateExecutionParams
): Promise<{ executionId: string }> {
  const id = generateId();

  await db.insert(directExecutions).values({
    id,
    organizationId: params.organizationId,
    apiKeyId: params.apiKeyId,
    type: params.type,
    network: params.network,
    // biome-ignore lint/suspicious/noExplicitAny: jsonb column accepts arbitrary serializable data
    input: params.input as any,
    status: "pending",
  });

  return { executionId: id };
}

export async function markRunning(executionId: string): Promise<void> {
  await db
    .update(directExecutions)
    .set({ status: "running" })
    .where(eq(directExecutions.id, executionId));
}

export async function completeExecution(
  executionId: string,
  result: CompleteParams
): Promise<void> {
  await db
    .update(directExecutions)
    .set({
      status: "completed",
      transactionHash: result.transactionHash,
      gasUsedWei: result.gasUsedWei,
      // biome-ignore lint/suspicious/noExplicitAny: jsonb column accepts arbitrary serializable data
      output: (result.output ?? {}) as any,
      completedAt: new Date(),
    })
    .where(eq(directExecutions.id, executionId));
}

export async function failExecution(
  executionId: string,
  error: string
): Promise<void> {
  await db
    .update(directExecutions)
    .set({
      status: "failed",
      error,
      completedAt: new Date(),
    })
    .where(eq(directExecutions.id, executionId));
}

const SENSITIVE_FIELDS = ["privateKey", "secret", "password", "mnemonic"];

export function redactInput(
  input: Record<string, unknown>
): Record<string, unknown> {
  const redacted = { ...input };

  if (typeof redacted.abi === "string" && redacted.abi.length > 100) {
    redacted.abi = `${redacted.abi.slice(0, 100)}... (truncated)`;
  }

  for (const key of SENSITIVE_FIELDS) {
    if (key in redacted) {
      redacted[key] = "[REDACTED]";
    }
  }

  return redacted;
}
