import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for Docker / production deploys.
  output: "standalone",
};

export default nextConfig;
