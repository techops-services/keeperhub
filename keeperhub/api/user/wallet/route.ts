import { Environment, Para as ParaServer } from "@getpara/server-sdk";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { encryptUserShare } from "@/keeperhub/lib/encryption";
import {
  getOrganizationWallet,
  organizationHasWallet,
} from "@/keeperhub/lib/para/wallet-helpers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createIntegration } from "@/lib/db/integrations";
import { integrations, paraWallets } from "@/lib/db/schema";

const PARA_API_KEY = process.env.PARA_API_KEY || "";
const PARA_ENV = process.env.PARA_ENVIRONMENT || "beta";

// Helper: Validate user authentication, organization membership, and admin permissions
async function validateUserAndOrganization(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = session.user;

  if (!user.email) {
    return { error: "Email required to create wallet", status: 400 };
  }

  // Check if user is anonymous
  if (
    user.email.includes("@http://") ||
    user.email.includes("@https://") ||
    user.email.startsWith("temp-")
  ) {
    return {
      error:
        "Anonymous users cannot create wallets. Please sign in with a real account.",
      status: 400,
    };
  }

  // Get active organization from session
  const activeOrgId = session.session.activeOrganizationId;

  if (!activeOrgId) {
    return {
      error: "No active organization. Please select or create an organization.",
      status: 400,
    };
  }

  // Get user's member record in the active organization
  const activeMember = await auth.api.getActiveMember({
    headers: await headers(),
  });

  if (!activeMember) {
    return {
      error: "You are not a member of the active organization",
      status: 403,
    };
  }

  // Check if user has admin or owner role
  const role = activeMember.role;
  if (role !== "admin" && role !== "owner") {
    return {
      error: "Only organization admins and owners can manage wallets",
      status: 403,
    };
  }

  return { user, organizationId: activeOrgId, member: activeMember };
}

// Helper: Check if wallet or integration already exists for organization
async function checkExistingWallet(organizationId: string) {
  const hasWallet = await organizationHasWallet(organizationId);
  if (hasWallet) {
    return {
      error: "Wallet already exists for this organization",
      status: 400,
    };
  }

  const existingIntegration = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.type, "web3")
      )
    )
    .limit(1);

  if (existingIntegration.length > 0) {
    return {
      error: "Web3 integration already exists for this organization",
      status: 400,
    };
  }

  return { valid: true };
}

// Helper: Create wallet via Para SDK
async function createParaWallet(email: string) {
  if (!PARA_API_KEY) {
    console.error("[Para] PARA_API_KEY not configured");
    throw new Error("Para API key not configured");
  }

  const environment = PARA_ENV === "prod" ? Environment.PROD : Environment.BETA;
  console.log(
    `[Para] Initializing SDK with environment: ${PARA_ENV} (${environment})`
  );
  console.log(`[Para] API key: ${PARA_API_KEY.slice(0, 8)}...`);

  const paraClient = new ParaServer(environment, PARA_API_KEY);

  console.log(`[Para] Creating wallet for email: ${email}`);

  const wallet = await paraClient.createPregenWallet({
    type: "EVM",
    pregenId: { email },
  });

  const userShare = await paraClient.getUserShare();

  if (!userShare) {
    throw new Error("Failed to get user share from Para");
  }

  if (!(wallet.id && wallet.address)) {
    throw new Error("Invalid wallet data from Para");
  }

  return { wallet, userShare };
}

// Helper: Get user-friendly error response for wallet creation failures
function getErrorResponse(error: unknown) {
  console.error("[Para] Wallet creation failed:", error);

  let errorMessage = "Failed to create wallet";
  let statusCode = 500;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

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
      errorMessage = error.message;
    }
  }

  return NextResponse.json({ error: errorMessage }, { status: statusCode });
}

// Helper: Store wallet in database and create integration
async function storeWalletAndIntegration(options: {
  userId: string;
  organizationId: string;
  email: string;
  walletId: string;
  walletAddress: string;
  userShare: string;
}) {
  const { userId, organizationId, email, walletId, walletAddress, userShare } =
    options;

  // Store wallet in para_wallets table
  await db.insert(paraWallets).values({
    userId,
    organizationId,
    email,
    walletId,
    walletAddress,
    userShare: encryptUserShare(userShare),
  });

  console.log(
    `[Para] ✓ Wallet created for organization ${organizationId}: ${walletAddress}`
  );

  // Create Web3 integration record with truncated address as name
  const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  await createIntegration({
    userId,
    organizationId,
    name: truncatedAddress,
    type: "web3",
    config: {},
  });

  console.log(`[Para] ✓ Web3 integration created: ${truncatedAddress}`);

  return { walletAddress, walletId, truncatedAddress };
}

export async function GET(request: Request) {
  try {
    // Validate user and organization (no admin check for GET)
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return NextResponse.json({
        hasWallet: false,
        message: "No active organization selected",
      });
    }

    const hasWallet = await organizationHasWallet(activeOrgId);

    if (!hasWallet) {
      return NextResponse.json({
        hasWallet: false,
        message: "No Para wallet found for this organization",
      });
    }

    const wallet = await getOrganizationWallet(activeOrgId);

    return NextResponse.json({
      hasWallet: true,
      walletAddress: wallet.walletAddress,
      walletId: wallet.walletId,
      email: wallet.email,
      createdAt: wallet.createdAt,
      organizationId: wallet.organizationId,
    });
  } catch (error) {
    return apiError(error, "Failed to get wallet");
  }
}

export async function POST(request: Request) {
  try {
    // 1. Validate user, organization, and admin permissions
    const validation = await validateUserAndOrganization(request);
    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }
    const { user, organizationId } = validation;

    // 2. Check if wallet/integration already exists for this organization
    const existingCheck = await checkExistingWallet(organizationId);
    if ("error" in existingCheck) {
      return NextResponse.json(
        { error: existingCheck.error },
        { status: existingCheck.status }
      );
    }

    // 3. Get email from request body (user-provided, pre-filled with their email)
    const body = await request.json();
    const walletEmail = body.email;

    if (!walletEmail || typeof walletEmail !== "string") {
      return NextResponse.json(
        { error: "Email is required to create a wallet" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(walletEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // 4. Create wallet via Para SDK using user-provided email
    const { wallet, userShare } = await createParaWallet(walletEmail);

    // wallet.id and wallet.address are validated in createParaWallet
    const walletId = wallet.id as string;
    const walletAddress = wallet.address as string;

    // 5. Store wallet and create integration
    await storeWalletAndIntegration({
      userId: user.id,
      organizationId,
      email: walletEmail,
      walletId,
      walletAddress,
      userShare,
    });

    // 6. Return success
    return NextResponse.json({
      success: true,
      wallet: {
        address: walletAddress,
        walletId,
        email: walletEmail,
        organizationId,
      },
    });
  } catch (error) {
    return getErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Validate user, organization, and admin permissions
    const validation = await validateUserAndOrganization(request);
    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }
    const { organizationId } = validation;

    // 2. Delete wallet data for this organization
    const deletedWallet = await db
      .delete(paraWallets)
      .where(eq(paraWallets.organizationId, organizationId))
      .returning();

    if (deletedWallet.length === 0) {
      return NextResponse.json(
        { error: "No wallet found to delete" },
        { status: 404 }
      );
    }

    console.log(
      `[Para] Wallet deleted for organization ${organizationId}: ${deletedWallet[0].walletAddress}`
    );

    // 3. Delete associated Web3 integration record
    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.organizationId, organizationId),
          eq(integrations.type, "web3")
        )
      );

    console.log(
      `[Para] Web3 integration deleted for organization ${organizationId}`
    );

    return NextResponse.json({
      success: true,
      message: "Wallet deleted successfully",
    });
  } catch (error) {
    return apiError(error, "Failed to delete wallet");
  }
}
