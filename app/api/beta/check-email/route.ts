import { NextResponse } from "next/server";

import betaAllowlist from "@/config/beta-allowlist.json";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const isAllowlisted = betaAllowlist.emails.some(
      (e) => e.toLowerCase() === email.toLowerCase().trim()
    );

    return NextResponse.json({ isAllowlisted });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
