/**
 * Executable step function for HTTP Request action
 */
import "server-only";

import { getErrorMessage } from "../utils";

type HttpRequestResult =
  | { success: true; data: unknown; status: number }
  | { success: false; error: string; status?: number };

export async function httpRequestStep(input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}): Promise<HttpRequestResult> {
  "use step";

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `HTTP request failed with status ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { success: true, data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: `HTTP request failed: ${getErrorMessage(error)}`,
    };
  }
}
