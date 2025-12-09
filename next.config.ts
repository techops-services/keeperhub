import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withWorkflow(nextConfig, {
  // Disable file-based storage since we use database logging
  storage: { type: "memory" },
});
