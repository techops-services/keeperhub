import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { betaAccessRequests } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await db.insert(betaAccessRequests).values({
      email: email.toLowerCase().trim(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
