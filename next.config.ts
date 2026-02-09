import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig = {
  output: "standalone",
  // start custom keeperhub code //
  // The SDK loads @workflow/world-postgres via dynamic
  // require(process.env.WORKFLOW_TARGET_WORLD) which the standalone output
  // tracer cannot follow. serverExternalPackages keeps it out of the bundle
  // and outputFileTracingIncludes forces it into the standalone node_modules.
  serverExternalPackages: ["@workflow/world-postgres"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@workflow/world-postgres/**/*"],
  },
  // end keeperhub code //
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/trustwallet/assets/**",
      },
    ],
  },
} satisfies NextConfig & { eslint?: { ignoreDuringBuilds?: boolean } };

const { SENTRY_ORG, SENTRY_PROJECT } = process.env;

export default withSentryConfig(withWorkflow(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: SENTRY_ORG,
  project: SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
