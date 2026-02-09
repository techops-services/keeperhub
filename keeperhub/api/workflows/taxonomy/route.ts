import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export async function GET(): Promise<NextResponse> {
  try {
    const [categoryRows, protocolRows] = await Promise.all([
      db
        .selectDistinct({ category: workflows.category })
        .from(workflows)
        .where(
          and(eq(workflows.visibility, "public"), isNotNull(workflows.category))
        )
        .then((rows) =>
          rows
            .map((r) => r.category)
            .filter((c): c is string => c !== null && c !== "")
        ),
      db
        .selectDistinct({ protocol: workflows.protocol })
        .from(workflows)
        .where(
          and(eq(workflows.visibility, "public"), isNotNull(workflows.protocol))
        )
        .then((rows) =>
          rows
            .map((r) => r.protocol)
            .filter((p): p is string => p !== null && p !== "")
        ),
    ]);

    return NextResponse.json({
      categories: categoryRows.sort(),
      protocols: protocolRows.sort(),
    });
  } catch (error) {
    console.error("Failed to get workflow taxonomy:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get workflow taxonomy",
      },
      { status: 500 }
    );
  }
}
