import { NextResponse } from "next/server";
import { Environment, Para as ParaServer } from "@getpara/server-sdk";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { paraWallets, integrations } from "@/lib/db/schema";
import { encryptUserShare } from "@/lib/encryption";
import { getUserWallet, userHasWallet } from "@/lib/para/wallet-helpers";
import { createIntegration } from "@/lib/db/integrations";

const PARA_API_KEY = process.env.PARA_API_KEY!;
const PARA_ENV = process.env.PARA_ENVIRONMENT || "beta";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasWallet = await userHasWallet(session.user.id);

    if (!hasWallet) {
      return NextResponse.json({
        hasWallet: false,
        message: "No Para wallet found for this user",
      });
    }

    const wallet = await getUserWallet(session.user.id);

    return NextResponse.json({
      hasWallet: true,
      walletAddress: wallet.walletAddress,
      walletId: wallet.walletId,
      email: wallet.email,
      createdAt: wallet.createdAt,
    });
  } catch (error) {
    console.error("Failed to get wallet:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get wallet",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // 2. Check user has valid email (not anonymous)
    if (!user.email) {
      return NextResponse.json(
        { error: "Email required to create wallet" },
        { status: 400 }
      );
    }

    // Check if user is anonymous (has email like temp-xxx@http://localhost:3000)
    if (user.email.includes("@http://") || user.email.includes("@https://") || user.email.startsWith("temp-")) {
      return NextResponse.json(
        { error: "Anonymous users cannot create wallets. Please sign in with a real account." },
        { status: 400 }
      );
    }

    // 3. Check if wallet already exists
    const hasWallet = await userHasWallet(user.id);
    if (hasWallet) {
      return NextResponse.json(
        { error: "Wallet already exists for this user" },
        { status: 400 }
      );
    }

    // 4. Check if Web3 integration already exists (additional safety check)
    const existingIntegration = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, user.id),
          eq(integrations.type, "web3")
        )
      )
      .limit(1);

    if (existingIntegration.length > 0) {
      return NextResponse.json(
        { error: "Web3 integration already exists for this user" },
        { status: 400 }
      );
    }

    // 5. Validate Para API key
    if (!PARA_API_KEY) {
      console.error("[Para] PARA_API_KEY not configured");
      return NextResponse.json(
        { error: "Para API key not configured" },
        { status: 500 }
      );
    }

    // 6. Initialize Para SDK
    const environment = PARA_ENV === "prod" ? Environment.PROD : Environment.BETA;
    console.log(`[Para] Initializing SDK with environment: ${PARA_ENV} (${environment})`);
    console.log(`[Para] API key: ${PARA_API_KEY.slice(0, 8)}...`);

    const paraClient = new ParaServer(environment, PARA_API_KEY);

    // 7. Skip wallet existence check - might be causing 403
    // Note: createPregenWallet should be idempotent anyway

    // 8. Create wallet via Para SDK
    console.log(`[Para] Creating wallet for user ${user.id} (${user.email})`);

    const wallet = await paraClient.createPregenWallet({
      type: "EVM",
      pregenId: { email: user.email },
    });

    // 9. Get user share (cryptographic key for signing)
    const userShare = await paraClient.getUserShare();

    if (!userShare) {
      throw new Error("Failed to get user share from Para");
    }

    if (!(wallet.id && wallet.address)) {
      throw new Error("Invalid wallet data from Para");
    }

    // 10. Store wallet in para_wallets table
    await db.insert(paraWallets).values({
      userId: user.id,
      email: user.email,
      walletId: wallet.id,
      walletAddress: wallet.address,
      userShare: encryptUserShare(userShare), // Encrypted!
    });

    console.log(`[Para] ✓ Wallet created: ${wallet.address}`);

    // 11. Create Web3 integration record with truncated address as name
    const truncatedAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    await createIntegration(
      user.id,
      truncatedAddress,
      "web3",
      {} // Empty config for web3
    );

    console.log(`[Para] ✓ Web3 integration created: ${truncatedAddress}`);

    // 12. Return success
    return NextResponse.json({
      success: true,
      wallet: {
        address: wallet.address,
        walletId: wallet.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Para] Wallet creation failed:", error);

    // Extract user-friendly error message
    let errorMessage = "Failed to create wallet";
    let statusCode = 500;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for specific Para API errors
      if (message.includes("already exists")) {
        errorMessage = "A wallet already exists for this email address";
        statusCode = 409;
      } else if (message.includes("invalid email")) {
        errorMessage = "Invalid email format";
        statusCode = 400;
      } else if (message.includes("forbidden") || message.includes("403")) {
        errorMessage = "API key authentication failed. Please contact support.";
        statusCode = 403;
      } else {
        // Include the actual error message for other errors
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: statusCode }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // 2. Delete wallet data
    const deletedWallet = await db
      .delete(paraWallets)
      .where(eq(paraWallets.userId, user.id))
      .returning();

    if (deletedWallet.length === 0) {
      return NextResponse.json(
        { error: "No wallet found to delete" },
        { status: 404 }
      );
    }

    console.log(
      `[Para] Wallet deleted for user ${user.id}: ${deletedWallet[0].walletAddress}`
    );

    // 3. Delete associated Web3 integration record
    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.userId, user.id),
          eq(integrations.type, "web3")
        )
      );

    console.log(`[Para] Web3 integration deleted for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Wallet deleted successfully",
    });
  } catch (error) {
    console.error("[Para] Wallet deletion failed:", error);
    return NextResponse.json(
      {
        error: "Failed to delete wallet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
