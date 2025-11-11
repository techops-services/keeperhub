"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

/**
 * Update a Vercel project (currently only supports name updates)
 */
export async function update(projectId: string, data: { name: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!data.name?.trim()) {
    throw new Error("Project name is required");
  }

  // Update project in database
  const [updatedProject] = await db
    .update(projects)
    .set({
      name: data.name.trim(),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  if (!updatedProject) {
    throw new Error("Project not found");
  }

  return updatedProject;
}
