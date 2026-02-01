import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Enable standalone output for optimized Docker builds
  output: "standalone",

  // Disable telemetry in production
  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      // Optimize for Docker/container deployments
    },
  }),
};

export default nextConfig;
