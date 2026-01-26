import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { isValidEthereumAddress } from "@/keeperhub/lib/utils/address-validation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addressBookEntry, users } from "@/lib/db/schema";

// GET - List all address book entries for the current organization
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgContext = await getOrgContext();
    const activeOrgId = orgContext.organization?.id;

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    // List all address book entries for the organization
    const entries = await db
      .select({
        id: addressBookEntry.id,
        label: addressBookEntry.label,
        address: addressBookEntry.address,
        createdAt: addressBookEntry.createdAt,
        updatedAt: addressBookEntry.updatedAt,
        createdBy: addressBookEntry.createdBy,
      })
      .from(addressBookEntry)
      .where(eq(addressBookEntry.organizationId, activeOrgId))
      .orderBy(desc(addressBookEntry.createdAt));

    // Get unique creator IDs and fetch their names
    const creatorIds = [
      ...new Set(entries.map((e) => e.createdBy).filter(Boolean)),
    ] as string[];
    const creators =
      creatorIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, creatorIds),
            columns: { id: true, name: true },
          })
        : [];
    const creatorMap = new Map(creators.map((u) => [u.id, u.name]));

    // Add createdByName to response
    const response = entries.map((entry) => ({
      ...entry,
      createdByName: entry.createdBy
        ? creatorMap.get(entry.createdBy) || null
        : null,
      createdBy: undefined,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Address Book] Failed to list entries:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list address book entries",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new address book entry for the current organization
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgContext = await getOrgContext();
    const activeOrgId = orgContext.organization?.id;

    if (!activeOrgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    // Get active member to check permissions
    const activeMember = await auth.api.getActiveMember({
      headers: await headers(),
    });

    if (!activeMember) {
      return NextResponse.json(
        { error: "You are not a member of the active organization" },
        { status: 403 }
      );
    }

    // Check if user is owner
    if (activeMember.role !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can create address book entries" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const label = body.label?.trim();
    const address = body.address?.trim();

    if (!(label && address)) {
      return NextResponse.json(
        { error: "Label and address are required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!isValidEthereumAddress(address)) {
      return NextResponse.json(
        { error: "Invalid Ethereum address format" },
        { status: 400 }
      );
    }

    // Check for duplicate address within the organization
    const existingEntries = await db
      .select()
      .from(addressBookEntry)
      .where(
        and(
          eq(addressBookEntry.organizationId, activeOrgId),
          eq(addressBookEntry.address, address)
        )
      )
      .limit(1);

    const existingEntry = existingEntries[0];

    if (existingEntry) {
      return NextResponse.json(
        { error: "This address already exists in the address book" },
        { status: 409 }
      );
    }

    // Create new entry
    const [newEntry] = await db
      .insert(addressBookEntry)
      .values({
        organizationId: activeOrgId,
        label,
        address,
        createdBy: session.user.id,
      })
      .returning({
        id: addressBookEntry.id,
        label: addressBookEntry.label,
        address: addressBookEntry.address,
        createdAt: addressBookEntry.createdAt,
        updatedAt: addressBookEntry.updatedAt,
        createdBy: addressBookEntry.createdBy,
      });

    console.log(
      `[Address Book] Created new entry for organization ${activeOrgId}: ${newEntry.id}`
    );

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error("[Address Book] Failed to create entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create address book entry",
      },
      { status: 500 }
    );
  }
}
