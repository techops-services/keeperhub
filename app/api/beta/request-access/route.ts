import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { betaAccessRequests } from "@/lib/db/schema";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

async function sendAccessRequestEmail(email: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromAddress = process.env.FROM_ADDRESS || "noreply@keeperhub.com";
  const notifyEmail = "simon+keeperhub@techops.services";

  if (!apiKey) {
    console.error(
      "SENDGRID_API_KEY not configured, skipping email notification"
    );
    return;
  }

  const emailData = {
    personalizations: [
      {
        to: [{ email: notifyEmail }],
        subject: "New Access Request from KeeperHub",
      },
    ],
    from: { email: fromAddress },
    content: [
      {
        type: "text/plain",
        value: `Access request from ${email}`,
      },
      {
        type: "text/html",
        value: `
          <h3>New Access Request</h3>
          <p><strong>From:</strong> ${email}</p>
        `,
      },
    ],
  };

  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    console.error("Failed to send access request email:", response.status);
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    await db.insert(betaAccessRequests).values({
      email: normalizedEmail,
    });

    // Send email notification (non-blocking)
    sendAccessRequestEmail(normalizedEmail).catch((err) => {
      console.error("Failed to send access request notification:", err);
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
