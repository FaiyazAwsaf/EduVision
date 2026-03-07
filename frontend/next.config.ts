import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Use standalone output only for Docker builds, not for Vercel
  ...(process.env.DOCKER_BUILD === "true" && { output: "standalone" }),
};

export default nextConfig;
