"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import type { SavedWorkflow } from "./types";
import { getSession } from "./utils";

/**
 * Get all workflows for the current user
 */
export async function getAll(): Promise<SavedWorkflow[]> {
  const session = await getSession();

  const userWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, session.user.id))
    .orderBy(desc(workflows.updatedAt));

  return userWorkflows as SavedWorkflow[];
}
