/**
 * Executable step function for Send Email action
 *
 * SECURITY PATTERN - External Secret Store:
 * - Step input contains only a REFERENCE (workflowId), not actual credentials
 * - Step fetches credentials internally using the reference
 * - Credentials are used in memory only
 * - Step output contains no credentials
 *
 * This ensures:
 * - Credentials are never logged in Vercel's workflow observability
 * - Works for both production (process.env) and test runs (Vercel API fetch)
 * - Follows Vercel Workflow DevKit best practices
 */
import "server-only";

import { Resend } from "resend";
import { fetchCredentials } from "../credential-fetcher";
import { getErrorMessage } from "../utils";

type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function sendEmailStep(input: {
  integrationId?: string; // Reference to fetch credentials (safe to log)
  emailTo: string;
  emailSubject: string;
  emailBody: string;
}): Promise<SendEmailResult> {
  "use step";

  // SECURITY: Fetch credentials using the integration ID reference
  // This happens in a secure, non-persisted context (not logged by observability)
  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  const apiKey = credentials.RESEND_API_KEY;
  const fromEmail = credentials.RESEND_FROM_EMAIL;

  if (!apiKey) {
    return {
      success: false,
      error:
        "RESEND_API_KEY is not configured. Please add it in Project Integrations.",
    };
  }

  if (!fromEmail) {
    return {
      success: false,
      error:
        "RESEND_FROM_EMAIL is not configured. Please add it in Project Integrations.",
    };
  }

  try {
    // Use credentials in memory only
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: fromEmail,
      to: input.emailTo,
      subject: input.emailSubject,
      text: input.emailBody,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message || "Failed to send email",
      };
    }

    // Return result WITHOUT credentials (safe to log)
    return { success: true, id: result.data?.id || "" };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send email: ${getErrorMessage(error)}`,
    };
  }
}
