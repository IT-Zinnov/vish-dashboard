import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/dashboard/prototype": ["./prototype/zinnov_coe_v3_10_1.html"],
  },
};

export default nextConfig;
