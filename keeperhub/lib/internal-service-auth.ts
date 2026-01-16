/**
 * Internal Service Authentication
 *
 * Authenticates requests from internal K8s services (MCP, Events, Feedback).
 * Each service has its own API key stored in SSM parameters.
 *
 * Usage:
 * ```typescript
 * const authResult = authenticateInternalService(request);
 * if (!authResult.authenticated) {
 *   return NextResponse.json({ error: authResult.error }, { status: 401 });
 * }
 * // authResult.service contains the service name
 * ```
 */

import crypto from "node:crypto";

export type InternalServiceName = "mcp" | "events" | "scheduler";

export type InternalServiceAuthResult = {
  authenticated: boolean;
  service?: InternalServiceName;
  error?: string;
};

// Service API keys from environment variables
const SERVICE_KEYS: Record<InternalServiceName, string | undefined> = {
  mcp: process.env.MCP_SERVICE_API_KEY,
  events: process.env.EVENTS_SERVICE_API_KEY,
  scheduler: process.env.SCHEDULER_SERVICE_API_KEY,
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Authenticate a request from an internal service
 *
 * Expected header: `X-Service-Key: <service-api-key>`
 *
 * @param request - The incoming HTTP request
 * @returns Authentication result with service name
 */
export function authenticateInternalService(
  request: Request
): InternalServiceAuthResult {
  const serviceKey = request.headers.get("X-Service-Key");

  if (!serviceKey) {
    return {
      authenticated: false,
      error: "Missing X-Service-Key header",
    };
  }

  // Check against each service's key
  for (const [service, expectedKey] of Object.entries(SERVICE_KEYS)) {
    if (expectedKey && secureCompare(serviceKey, expectedKey)) {
      return {
        authenticated: true,
        service: service as InternalServiceName,
      };
    }
  }

  return {
    authenticated: false,
    error: "Invalid service key",
  };
}

/**
 * Check if a request is from a specific internal service
 */
export function isFromService(
  request: Request,
  service: InternalServiceName
): boolean {
  const result = authenticateInternalService(request);
  return result.authenticated && result.service === service;
}

/**
 * Middleware helper that returns the service name if authenticated
 */
export function getInternalService(request: Request): InternalServiceName | null {
  const result = authenticateInternalService(request);
  return result.authenticated ? result.service || null : null;
}
