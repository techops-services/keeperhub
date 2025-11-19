"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export async function getProjectByVercelId(vercelProjectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.vercelProjectId, vercelProjectId),
  });

  return project || null;
}
