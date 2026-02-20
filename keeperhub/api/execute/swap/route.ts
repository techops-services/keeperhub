import "server-only";

import { NextResponse } from "next/server";
import { validateApiKey } from "../_lib/auth";
import { checkRateLimit } from "../_lib/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  const apiKeyCtx = await validateApiKey(request);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(apiKeyCtx.apiKeyId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  return NextResponse.json({ message: "Coming soon" }, { status: 501 });
}
