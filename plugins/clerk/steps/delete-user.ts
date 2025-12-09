import "server-only";

import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
import type { ClerkCredentials } from "../credentials";

type DeleteUserResult =
  | { success: true; data: { deleted: true } }
  | { success: false; error: { message: string } };

export type ClerkDeleteUserCoreInput = {
  userId: string;
};

export type ClerkDeleteUserInput = StepInput &
  ClerkDeleteUserCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic - portable between app and export
 */
async function stepHandler(
  input: ClerkDeleteUserCoreInput,
  credentials: ClerkCredentials
): Promise<DeleteUserResult> {
  const secretKey = credentials.CLERK_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      error: {
        message:
          "CLERK_SECRET_KEY is not configured. Please add it in Project Integrations.",
      },
    };
  }

  if (!input.userId) {
    return {
      success: false,
      error: { message: "User ID is required." },
    };
  }

  try {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(input.userId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          "User-Agent": "workflow-builder.dev",
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          message:
            errorBody.errors?.[0]?.message ||
            `Failed to delete user: ${response.status}`,
        },
      };
    }

    return { success: true, data: { deleted: true } };
  } catch (err) {
    return {
      success: false,
      error: { message: `Failed to delete user: ${getErrorMessage(err)}` },
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function clerkDeleteUserStep(
  input: ClerkDeleteUserInput
): Promise<DeleteUserResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials));
}
clerkDeleteUserStep.maxRetries = 0;

export const _integrationType = "clerk";
