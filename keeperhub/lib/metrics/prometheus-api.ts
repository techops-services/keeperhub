/**
 * Prometheus API Exports
 *
 * This module is ONLY imported by the /api/metrics route handler.
 * It is NOT safe to import from workflow code as it includes Node.js-only dependencies.
 *
 * @module prometheus-api
 */
import "server-only";

export {
  // start custom keeperhub code //
  getApiProcessMetrics,
  getDbMetrics,
  // end keeperhub code //
  getPrometheusContentType,
  getPrometheusMetrics,
  prometheusMetricsCollector,
  // start custom keeperhub code //
  updateDbMetrics,
  // end keeperhub code //
} from "./collectors/prometheus";
