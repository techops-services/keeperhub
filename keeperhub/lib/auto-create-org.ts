// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  organization as organizationTable,
  member as memberTable,
  sessions,
} from "@/lib/db/schema";

/**
 * Auto-create a personal organization for a user if they don't have one
 * This is called on first authenticated request
 */
export async function ensureUserHasOrganization(
  userId: string,
  userEmail?: string,
  userName?: string,
  sessionId?: string
): Promise<{ organizationId: string; created: boolean }> {
  // Check if user already has any organizations
  const [existingMember] = await db
    .select()
    .from(memberTable)
    .where(eq(memberTable.userId, userId))
    .limit(1);

  if (existingMember) {
    return { organizationId: existingMember.organizationId, created: false };
  }

  // User has no org - create one
  const baseName = userName || userEmail?.split("@")[0] || "User";
  const slug = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;

  console.log(
    `[Auto-Create] Creating organization for user ${userEmail || userId}`
  );

  try {
    const orgId = randomUUID();
    const memberId = randomUUID();

    // Create organization
    const [org] = await db
      .insert(organizationTable)
      .values({
        id: orgId,
        name: `${baseName}'s Organization`,
        slug,
        createdAt: new Date(),
      })
      .returning();

    // Add user as owner member
    await db.insert(memberTable).values({
      id: memberId,
      organizationId: org.id,
      userId: userId,
      role: "owner",
      createdAt: new Date(),
    });

    // Set as active organization in session if available
    if (sessionId) {
      await db
        .update(sessions)
        .set({ activeOrganizationId: org.id })
        .where(eq(sessions.id, sessionId));
    }

    console.log(
      `[Auto-Create] Organization "${org.name}" created and set as active for ${userEmail || userId}`
    );

    return { organizationId: org.id, created: true };
  } catch (error) {
    console.error(
      `[Auto-Create] Failed to create org for ${userEmail || userId}:`,
      error
    );
    throw error;
  }
}
// end keeperhub code //
