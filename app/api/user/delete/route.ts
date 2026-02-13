// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logAuthError } from "@/keeperhub/lib/logging";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

/**
 * POST /api/user/delete
 * Deactivates the user account (soft delete)
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { confirmation?: string };
    const { confirmation } = body;

    if (confirmation !== "DEACTIVATE") {
      return NextResponse.json(
        { error: "Please type DEACTIVATE to confirm" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isAnonymous) {
      return NextResponse.json(
        { error: "Anonymous users cannot deactivate accounts" },
        { status: 403 }
      );
    }

    if (user.deactivatedAt) {
      return NextResponse.json(
        { error: "Account is already deactivated" },
        { status: 400 }
      );
    }

    // Deactivate the account
    await db
      .update(users)
      .set({ deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Invalidate all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId));

    return NextResponse.json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    logAuthError("[User Delete] Failed to deactivate account:", error, {
      endpoint: "/api/user/delete",
      status_code: "500",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to deactivate account",
      },
      { status: 500 }
    );
  }
}
// end keeperhub code //
