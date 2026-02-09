/**
 * Next.js instrumentation file
 * This runs once when the server starts (before any requests are handled)
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Patch console with LOG_LEVEL support
  // This must be imported dynamically to ensure it runs at startup
  await import("@/lib/logger");

  // Only register process handlers in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamically import Sentry to ensure it's available
    const Sentry = await import("@sentry/nextjs");

    // Initialize Prometheus metrics collector if enabled
    if (process.env.METRICS_COLLECTOR === "prometheus") {
      const { prometheusMetricsCollector } = await import(
        "@/keeperhub/lib/metrics/collectors/prometheus"
      );
      const { createDualWriteCollector } = await import(
        "@/keeperhub/lib/metrics/collectors/dual"
      );
      const { setMetricsCollector } = await import("@/keeperhub/lib/metrics");

      // Use dual-write to send metrics to both console and Prometheus
      const dualCollector = createDualWriteCollector(
        prometheusMetricsCollector
      );
      setMetricsCollector(dualCollector);
      console.log("[Metrics] Prometheus dual-write collector initialized");
    }

    // start custom keeperhub code //
    // Initialize Workflow Postgres World (pg-boss queue polling)
    if (process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres") {
      const { getWorld } = await import("workflow/runtime");
      const world = getWorld();
      if (world.start) {
        await world.start();
        console.log("[Workflow] Postgres World initialized");
      }
    }
    // end keeperhub code //

    // Catch unhandled promise rejections (would otherwise be silent)
    process.on("unhandledRejection", (reason) => {
      console.error(
        "Unhandled Rejection:",
        reason instanceof Error ? reason.message : reason,
        reason instanceof Error ? reason.stack : ""
      );

      // Send to Sentry
      if (reason instanceof Error) {
        Sentry.captureException(reason);
      } else {
        Sentry.captureException(
          new Error(`Unhandled Rejection: ${String(reason)}`)
        );
      }
    });

    // Catch uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error.message, error.stack);

      // Send to Sentry
      Sentry.captureException(error);
    });
  }
}
