import "server-only";

import { NextResponse } from "next/server";
import { transferFundsCore } from "@/keeperhub/plugins/web3/steps/transfer-funds-core";
import { transferTokenCore } from "@/keeperhub/plugins/web3/steps/transfer-token-core";
import { validateApiKey } from "../_lib/auth";
import {
  completeExecution,
  createExecution,
  failExecution,
  markRunning,
  redactInput,
} from "../_lib/execution-service";
import { checkRateLimit } from "../_lib/rate-limit";
import { checkSpendingCap } from "../_lib/spending-cap";
import type { ExecuteErrorResponse } from "../_lib/types";

function validateTransferBody(
  body: Record<string, unknown>
): ExecuteErrorResponse | null {
  if (typeof body.network !== "string" || body.network.trim() === "") {
    return {
      error: "Missing required field",
      field: "network",
      details: "network is required and must be a non-empty string",
    };
  }

  if (
    typeof body.recipientAddress !== "string" ||
    body.recipientAddress.trim() === ""
  ) {
    return {
      error: "Missing required field",
      field: "recipientAddress",
      details: "recipientAddress is required and must be a non-empty string",
    };
  }

  if (typeof body.amount !== "string" || body.amount.trim() === "") {
    return {
      error: "Missing required field",
      field: "amount",
      details: "amount is required and must be a non-empty string",
    };
  }

  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Auth
  const apiKeyCtx = await validateApiKey(request);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit
  const rateLimit = checkRateLimit(apiKeyCtx.apiKeyId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  // 3. Parse body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 4. Validate input
  const validationError = validateTransferBody(body);
  if (validationError) {
    return NextResponse.json(validationError, { status: 400 });
  }

  const { network, recipientAddress, amount } = body as {
    network: string;
    recipientAddress: string;
    amount: string;
  };

  const isTokenTransfer = "tokenAddress" in body || "tokenConfig" in body;

  // 5. Spending cap
  const spendCap = await checkSpendingCap(apiKeyCtx.organizationId);
  if (!spendCap.allowed) {
    return NextResponse.json({ error: spendCap.reason }, { status: 403 });
  }

  // 6. Create execution record
  const redactedInput = redactInput(body);
  const { executionId } = await createExecution({
    organizationId: apiKeyCtx.organizationId,
    apiKeyId: apiKeyCtx.apiKeyId,
    type: "transfer",
    network,
    input: redactedInput,
  });

  // 7. Mark running
  await markRunning(executionId);

  // 8. Execute
  const context = { organizationId: apiKeyCtx.organizationId };

  const result = isTokenTransfer
    ? await transferTokenCore({
        network,
        tokenConfig: (body.tokenConfig ?? "") as
          | string
          | Record<string, unknown>,
        tokenAddress: body.tokenAddress as string | undefined,
        recipientAddress,
        amount,
        _context: context,
      })
    : await transferFundsCore({
        network,
        recipientAddress,
        amount,
        _context: context,
      });

  // 9. Handle result
  if (result.success) {
    // MVP: gasUsedWei requires receipt lookup; set to "0" for now. Upgrade in HARD-03.
    await completeExecution(executionId, {
      transactionHash: result.transactionHash,
      transactionLink: result.transactionLink,
      gasUsedWei: "0",
      output: result as unknown as Record<string, unknown>,
    });
  } else {
    await failExecution(executionId, result.error);
  }

  // 10. Return
  return NextResponse.json(
    { executionId, status: result.success ? "completed" : "failed" },
    { status: 202 }
  );
}
