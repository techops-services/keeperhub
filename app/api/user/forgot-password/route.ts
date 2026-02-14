// start custom keeperhub code //
import { randomInt } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  sendOAuthPasswordResetEmail,
  sendVerificationOTP,
} from "@/keeperhub/lib/email";
import { ErrorCategory, logSystemError } from "@/keeperhub/lib/logging";
import { hashPassword } from "@/keeperhub/lib/password";
import { db } from "@/lib/db";
import { accounts, users, verifications } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

const OAUTH_PROVIDERS = ["vercel", "github", "google"];
const OTP_EXPIRY_MINUTES = 5;

function generateOTP(): string {
  return randomInt(100_000, 999_999).toString();
}

/**
 * POST /api/user/forgot-password
 * Handles both request (send OTP) and reset (verify OTP + new password) flows
 * based on the action parameter in the request body
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      action?: "request" | "reset";
      email?: string;
      otp?: string;
      newPassword?: string;
    };

    const { action, email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (action === "reset") {
      return handleReset(normalizedEmail, body.otp, body.newPassword);
    }

    // Default to request action
    return handleRequest(normalizedEmail);
  } catch (error) {
    logSystemError(
      ErrorCategory.AUTH,
      "[Forgot Password] Failed to process request:",
      error,
      {
        endpoint: "/api/user/forgot-password",
        status_code: "500",
      }
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}

async function handleRequest(email: string): Promise<NextResponse> {
  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, a reset code has been sent.",
    });
  }

  // Check if user has a credential account
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id));

  const credentialAccount = userAccounts.find(
    (acc) => acc.providerId === "credential"
  );

  // If user only has OAuth, send a helpful email instead
  if (!credentialAccount) {
    const oauthAccount = userAccounts.find((acc) =>
      OAUTH_PROVIDERS.includes(acc.providerId)
    );

    if (oauthAccount) {
      const providerName =
        oauthAccount.providerId.charAt(0).toUpperCase() +
        oauthAccount.providerId.slice(1);
      await sendOAuthPasswordResetEmail({ email, providerName });
    }

    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, a reset code has been sent.",
    });
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing verification for this email
  await db.delete(verifications).where(eq(verifications.identifier, email));

  // Store verification
  await db.insert(verifications).values({
    id: generateId(),
    identifier: email,
    value: otp,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Send OTP email
  const emailSent = await sendVerificationOTP({
    email,
    otp,
    type: "forget-password",
  });

  if (!emailSent) {
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "If an account exists with this email, a reset code has been sent.",
  });
}

async function handleReset(
  email: string,
  otp: string | undefined,
  newPassword: string | undefined
): Promise<NextResponse> {
  if (!(otp && newPassword)) {
    return NextResponse.json(
      { error: "OTP and new password are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Find and verify OTP
  const verification = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.identifier, email),
      eq(verifications.value, otp),
      gt(verifications.expiresAt, new Date())
    ),
  });

  if (!verification) {
    return NextResponse.json(
      { error: "Invalid or expired verification code" },
      { status: 400 }
    );
  }

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find credential account
  const credentialAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, user.id),
      eq(accounts.providerId, "credential")
    ),
  });

  if (!credentialAccount) {
    return NextResponse.json(
      { error: "This account uses social login and cannot reset password" },
      { status: 400 }
    );
  }

  // Hash and update password
  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(accounts)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(accounts.id, credentialAccount.id));

  // Delete used verification
  await db.delete(verifications).where(eq(verifications.id, verification.id));

  return NextResponse.json({
    success: true,
    message: "Password has been reset successfully",
  });
}
// end keeperhub code //
