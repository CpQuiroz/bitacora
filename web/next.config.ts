import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitacora/shared", "@bitacora/ui"],
};

export default nextConfig;
