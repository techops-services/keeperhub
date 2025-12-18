import { CronExpressionParser } from "cron-parser";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflowSchedules } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import type { WorkflowNode } from "@/lib/workflow-store";

// Top-level regex for splitting cron expression fields
const CRON_FIELD_SPLITTER = /\s+/;

/**
 * Compute the next run time for a cron expression in a given timezone
 */
export function computeNextRunTime(
  cronExpression: string,
  timezone: string
): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
      tz: timezone,
    });
    return interval.next().toDate();
  } catch (error) {
    console.error(
      `[Schedule] Invalid cron expression: ${cronExpression}`,
      error
    );
    return null;
  }
}

/**
 * Validate a cron expression
 */
export function validateCronExpression(cronExpression: string): {
  valid: boolean;
  error?: string;
} {
  if (!cronExpression || typeof cronExpression !== "string") {
    return { valid: false, error: "Cron expression is required" };
  }

  // Basic format check (5 or 6 fields)
  const parts = cronExpression.trim().split(CRON_FIELD_SPLITTER);
  if (parts.length < 5 || parts.length > 6) {
    return {
      valid: false,
      error: "Cron expression must have 5 or 6 fields",
    };
  }

  try {
    CronExpressionParser.parse(cronExpression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid cron expression",
    };
  }
}

/**
 * Validate timezone string
 */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract schedule configuration from workflow trigger node
 */
export function extractScheduleConfig(
  nodes: WorkflowNode[]
): { cronExpression: string; timezone: string } | null {
  const triggerNode = nodes.find((n) => n.data.type === "trigger");

  if (!triggerNode) {
    return null;
  }

  const config = triggerNode.data.config;
  if (config?.triggerType !== "Schedule") {
    return null;
  }

  const cronExpression = config.scheduleCron as string | undefined;
  const timezone = (config.scheduleTimezone as string) || "UTC";

  if (!cronExpression) {
    return null;
  }

  return { cronExpression, timezone };
}

/**
 * Sync workflow schedule based on trigger configuration
 * Called when a workflow is saved
 */
export async function syncWorkflowSchedule(
  workflowId: string,
  nodes: WorkflowNode[]
): Promise<{ synced: boolean; error?: string }> {
  const scheduleConfig = extractScheduleConfig(nodes);

  if (!scheduleConfig) {
    // No schedule trigger - delete any existing schedule
    await db
      .delete(workflowSchedules)
      .where(eq(workflowSchedules.workflowId, workflowId));

    console.log(`[Schedule] Removed schedule for workflow ${workflowId}`);
    return { synced: true };
  }

  const { cronExpression, timezone } = scheduleConfig;

  // Validate cron expression
  const cronValidation = validateCronExpression(cronExpression);
  if (!cronValidation.valid) {
    console.warn(
      `[Schedule] Invalid cron for workflow ${workflowId}: ${cronValidation.error}`
    );
    return { synced: false, error: cronValidation.error };
  }

  // Validate timezone
  if (!validateTimezone(timezone)) {
    console.warn(
      `[Schedule] Invalid timezone for workflow ${workflowId}: ${timezone}`
    );
    return { synced: false, error: `Invalid timezone: ${timezone}` };
  }

  // Compute next run time
  const nextRunAt = computeNextRunTime(cronExpression, timezone);

  // Check for existing schedule
  const existingSchedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.workflowId, workflowId),
  });

  if (existingSchedule) {
    // Update existing
    await db
      .update(workflowSchedules)
      .set({
        cronExpression,
        timezone,
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(workflowSchedules.workflowId, workflowId));

    console.log(
      `[Schedule] Updated schedule for workflow ${workflowId}: ${cronExpression} (${timezone})`
    );
  } else {
    // Insert new
    await db.insert(workflowSchedules).values({
      id: generateId(),
      workflowId,
      cronExpression,
      timezone,
      enabled: true,
      nextRunAt,
    });

    console.log(
      `[Schedule] Created schedule for workflow ${workflowId}: ${cronExpression} (${timezone})`
    );
  }

  return { synced: true };
}

/**
 * Get schedule for a workflow
 */
export async function getWorkflowSchedule(
  workflowId: string
): Promise<typeof workflowSchedules.$inferSelect | null> {
  const schedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.workflowId, workflowId),
  });
  return schedule || null;
}

/**
 * Update schedule enabled status
 */
export async function setScheduleEnabled(
  workflowId: string,
  enabled: boolean
): Promise<void> {
  await db
    .update(workflowSchedules)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(workflowSchedules.workflowId, workflowId));

  console.log(
    `[Schedule] ${enabled ? "Enabled" : "Disabled"} schedule for workflow ${workflowId}`
  );
}

/**
 * Update schedule after execution
 */
export async function updateScheduleAfterRun(
  scheduleId: string,
  status: "success" | "error",
  error?: string
): Promise<void> {
  const schedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.id, scheduleId),
  });

  if (!schedule) {
    console.error(`[Schedule] Schedule not found: ${scheduleId}`);
    return;
  }

  const nextRunAt = computeNextRunTime(
    schedule.cronExpression,
    schedule.timezone
  );

  const runCount =
    status === "success"
      ? String(Number(schedule.runCount || "0") + 1)
      : schedule.runCount;

  await db
    .update(workflowSchedules)
    .set({
      lastRunAt: new Date(),
      lastStatus: status,
      lastError: status === "error" ? error : null,
      nextRunAt,
      runCount,
      updatedAt: new Date(),
    })
    .where(eq(workflowSchedules.id, scheduleId));

  console.log(`[Schedule] Updated schedule ${scheduleId} after run: ${status}`);
}
