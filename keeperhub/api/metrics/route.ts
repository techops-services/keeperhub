/**
 * Prometheus Metrics Endpoint
 *
 * Exposes application metrics in Prometheus format for scraping.
 * Only available when METRICS_COLLECTOR=prometheus is set.
 */

import { NextResponse } from "next/server";
import {
  getPrometheusMetrics,
  getPrometheusContentType,
} from "@/keeperhub/lib/metrics";

/**
 * GET /api/metrics
 *
 * Returns metrics in Prometheus text format.
 * This endpoint should only be accessible internally (not exposed publicly).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const metrics = await getPrometheusMetrics();
    const contentType = await getPrometheusContentType();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Metrics] Failed to get metrics:", error);
    return NextResponse.json(
      { error: "Failed to collect metrics" },
      { status: 500 }
    );
  }
}
