import { NextResponse } from "next/server";

// Hardcoded beta allowlist - add emails here
const BETA_ALLOWLIST = ["simon@techops.services", "sasha@techops.services", "jacob@techops.services", "dumitru@techops.services", "arty@techops.services", "luca@techops.services", "tait@techops.services" ];

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const isAllowlisted = BETA_ALLOWLIST.some(
      (e) => e.toLowerCase() === email.toLowerCase().trim()
    );

    return NextResponse.json({ isAllowlisted });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
