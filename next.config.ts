import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig = {
  output: "standalone",
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
} satisfies NextConfig & { eslint?: { ignoreDuringBuilds?: boolean } };

export default withWorkflow(nextConfig);
