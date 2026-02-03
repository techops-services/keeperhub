// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/keeperhub/lib/password";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

const OAUTH_PROVIDERS = ["vercel", "github", "google"];

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user's credential account
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, session.user.id));

    const credentialAccount = userAccounts.find(
      (acc) => acc.providerId === "credential"
    );

    // Check if user only has OAuth accounts
    const hasOnlyOAuth =
      !credentialAccount &&
      userAccounts.some((acc) => OAUTH_PROVIDERS.includes(acc.providerId));

    if (hasOnlyOAuth) {
      const oauthProvider = userAccounts.find((acc) =>
        OAUTH_PROVIDERS.includes(acc.providerId)
      );
      return NextResponse.json(
        {
          error: `Password is managed by ${oauthProvider?.providerId ?? "your OAuth provider"}. You cannot change it here.`,
        },
        { status: 403 }
      );
    }

    if (!credentialAccount) {
      return NextResponse.json(
        { error: "No password account found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const { currentPassword, newPassword } = body;

    if (!(currentPassword && newPassword)) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Verify current password
    if (!credentialAccount.password) {
      return NextResponse.json(
        { error: "Account has no password set" },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(
      currentPassword,
      credentialAccount.password
    );
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(accounts)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(accounts.id, credentialAccount.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to change password",
      },
      { status: 500 }
    );
  }
}
// end keeperhub code //
