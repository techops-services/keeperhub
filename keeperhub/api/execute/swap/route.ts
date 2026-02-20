import "server-only";

import { NextResponse } from "next/server";
import { validateApiKey } from "../_lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const apiKeyCtx = await validateApiKey(request);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ message: "Coming soon" }, { status: 501 });
}
