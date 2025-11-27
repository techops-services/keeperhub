/**
 * Executable step function for HTTP Request action
 */
import "server-only";

import { getErrorMessage } from "../utils";

type HttpRequestResult =
  | { success: true; data: unknown; status: number }
  | { success: false; error: string; status?: number };

function parseHeaders(httpHeaders?: string): Record<string, string> {
  if (!httpHeaders) {
    return {};
  }
  try {
    return JSON.parse(httpHeaders);
  } catch {
    return {};
  }
}

function parseBody(httpMethod: string, httpBody?: string): string | undefined {
  if (httpMethod === "GET" || !httpBody) {
    return;
  }
  try {
    const parsedBody = JSON.parse(httpBody);
    return Object.keys(parsedBody).length > 0
      ? JSON.stringify(parsedBody)
      : undefined;
  } catch {
    const trimmed = httpBody.trim();
    return trimmed && trimmed !== "{}" ? httpBody : undefined;
  }
}

function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function httpRequestStep(input: {
  endpoint: string;
  httpMethod: string;
  httpHeaders?: string;
  httpBody?: string;
}): Promise<HttpRequestResult> {
  "use step";

  if (!input.endpoint) {
    return {
      success: false,
      error: "HTTP request failed: URL is required",
    };
  }

  try {
    const response = await fetch(input.endpoint, {
      method: input.httpMethod,
      headers: parseHeaders(input.httpHeaders),
      body: parseBody(input.httpMethod, input.httpBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `HTTP request failed with status ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = await parseResponse(response);
    return { success: true, data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: `HTTP request failed: ${getErrorMessage(error)}`,
    };
  }
}
