/**
 * Step registry - Legacy file
 *
 * NOTE: This file is DEPRECATED. Use lib/step-registry.ts instead.
 * The auto-generated step-registry.ts provides dynamic imports for all plugins.
 *
 * This file is kept for backwards compatibility with system steps only.
 */

import type { checkBalanceStep } from "@/keeperhub/plugins/web3/steps/check-balance";
import type { transferFundsStep } from "@/keeperhub/plugins/web3/steps/transfer-funds";
import type { sendEmailStep } from "../../plugins/resend/steps/send-email";
import type { sendSlackMessageStep } from "../../plugins/slack/steps/send-slack-message";
import type { conditionStep } from "./condition";
import type { databaseQueryStep } from "./database-query";
import type { httpRequestStep } from "./http-request";

// Step function type
export type StepFunction = (input: Record<string, unknown>) => Promise<unknown>;

// Registry of system steps only (plugins are handled by lib/step-registry.ts)
export const stepRegistry: Record<string, StepFunction> = {
  "HTTP Request": async (input) =>
    (await import("./http-request")).httpRequestStep(
      input as Parameters<typeof httpRequestStep>[0]
    ),
  "Database Query": async (input) =>
    (await import("./database-query")).databaseQueryStep(
      input as Parameters<typeof databaseQueryStep>[0]
    ),
  Condition: async (input) =>
    (await import("./condition")).conditionStep(
      input as Parameters<typeof conditionStep>[0]
    ),
  "Send Email": async (input) =>
    (await import("../../plugins/resend/steps/send-email")).sendEmailStep(
      input as Parameters<typeof sendEmailStep>[0]
    ),
  "Send Slack Message": async (input) =>
    (
      await import("../../plugins/slack/steps/send-slack-message")
    ).sendSlackMessageStep(input as Parameters<typeof sendSlackMessageStep>[0]),
  "Transfer Funds": async (input) =>
    (
      await import("@/keeperhub/plugins/web3/steps/transfer-funds")
    ).transferFundsStep(input as Parameters<typeof transferFundsStep>[0]),
  "Check Balance": async (input) =>
    (
      await import("@/keeperhub/plugins/web3/steps/check-balance")
    ).checkBalanceStep(input as Parameters<typeof checkBalanceStep>[0]),
};

// Helper to check if a step exists
export function hasStep(actionType: string): boolean {
  return actionType in stepRegistry;
}

// Helper to get a step function
export function getStep(actionType: string): StepFunction | undefined {
  return stepRegistry[actionType];
}
