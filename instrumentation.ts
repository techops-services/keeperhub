/**
 * Next.js instrumentation file
 * This runs once when the server starts (before any requests are handled)
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Patch console with LOG_LEVEL support
  // This must be imported dynamically to ensure it runs at startup
  await import("@/lib/logger");
}
