import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { isValidEthereumAddress } from "@/keeperhub/lib/utils/address-validation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addressBookEntry } from "@/lib/db/schema";

// Helper: Validate authentication and owner permissions
async function validateOwnerPermission(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const orgContext = await getOrgContext();
  const activeOrgId = orgContext.organization?.id;

  if (!activeOrgId) {
    return {
      error: NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      ),
    };
  }

  const activeMember = await auth.api.getActiveMember({
    headers: await headers(),
  });

  if (!activeMember) {
    return {
      error: NextResponse.json(
        { error: "You are not a member of the active organization" },
        { status: 403 }
      ),
    };
  }

  if (activeMember.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Only organization owners can update address book entries" },
        { status: 403 }
      ),
    };
  }

  return { activeOrgId, session };
}

// Helper: Get existing entry and validate it belongs to organization
async function getExistingEntry(entryId: string, activeOrgId: string) {
  const existingEntries = await db
    .select()
    .from(addressBookEntry)
    .where(
      and(
        eq(addressBookEntry.id, entryId),
        eq(addressBookEntry.organizationId, activeOrgId)
      )
    )
    .limit(1);

  return existingEntries[0] || null;
}

// Helper: Check for duplicate address
async function checkDuplicateAddress(
  address: string,
  activeOrgId: string,
  excludeEntryId: string
) {
  const duplicates = await db
    .select()
    .from(addressBookEntry)
    .where(
      and(
        eq(addressBookEntry.organizationId, activeOrgId),
        eq(addressBookEntry.address, address),
        ne(addressBookEntry.id, excludeEntryId)
      )
    )
    .limit(1);

  return duplicates.length > 0;
}

// Helper: Validate and build update object
async function buildUpdateObject(
  body: { label?: string; address?: string },
  existingEntry: { address: string },
  activeOrgId: string,
  entryId: string
) {
  const updates: {
    label?: string;
    address?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  const label = body.label?.trim();
  if (label !== undefined) {
    if (!label) {
      return {
        error: NextResponse.json(
          { error: "Label cannot be empty" },
          { status: 400 }
        ),
      };
    }
    updates.label = label;
  }

  const address = body.address?.trim();
  if (address !== undefined) {
    if (!address) {
      return {
        error: NextResponse.json(
          { error: "Address cannot be empty" },
          { status: 400 }
        ),
      };
    }

    if (!isValidEthereumAddress(address)) {
      return {
        error: NextResponse.json(
          { error: "Invalid Ethereum address format" },
          { status: 400 }
        ),
      };
    }

    if (address !== existingEntry.address) {
      const isDuplicate = await checkDuplicateAddress(
        address,
        activeOrgId,
        entryId
      );
      if (isDuplicate) {
        return {
          error: NextResponse.json(
            { error: "This address already exists in the address book" },
            { status: 409 }
          ),
        };
      }
    }

    updates.address = address;
  }

  return { updates };
}

// PATCH - Update an address book entry
export async function PATCH(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await context.params;

    // Validate authentication and permissions
    const authResult = await validateOwnerPermission(request);
    if (authResult.error) {
      return authResult.error;
    }
    const { activeOrgId } = authResult;

    // Get existing entry
    const existingEntry = await getExistingEntry(entryId, activeOrgId);
    if (!existingEntry) {
      return NextResponse.json(
        { error: "Address book entry not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const updateResult = await buildUpdateObject(
      body,
      existingEntry,
      activeOrgId,
      entryId
    );
    if (updateResult.error) {
      return updateResult.error;
    }
    const { updates } = updateResult;

    // Update entry
    const [updatedEntry] = await db
      .update(addressBookEntry)
      .set(updates)
      .where(
        and(
          eq(addressBookEntry.id, entryId),
          eq(addressBookEntry.organizationId, activeOrgId)
        )
      )
      .returning({
        id: addressBookEntry.id,
        label: addressBookEntry.label,
        address: addressBookEntry.address,
        createdAt: addressBookEntry.createdAt,
        updatedAt: addressBookEntry.updatedAt,
        createdBy: addressBookEntry.createdBy,
      });

    console.log(
      `[Address Book] Updated entry ${entryId} for organization ${activeOrgId}`
    );

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("[Address Book] Failed to update entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update address book entry",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete an address book entry
export async function DELETE(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await context.params;
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
        { error: "Only organization owners can delete address book entries" },
        { status: 403 }
      );
    }

    // Verify entry exists and belongs to active organization, then delete
    const result = await db
      .delete(addressBookEntry)
      .where(
        and(
          eq(addressBookEntry.id, entryId),
          eq(addressBookEntry.organizationId, activeOrgId)
        )
      )
      .returning({ id: addressBookEntry.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Address book entry not found" },
        { status: 404 }
      );
    }

    console.log(
      `[Address Book] Deleted entry ${entryId} for organization ${activeOrgId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Address Book] Failed to delete entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete address book entry",
      },
      { status: 500 }
    );
  }
}
