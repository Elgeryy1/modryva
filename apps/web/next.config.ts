import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: standalone`: the Docker image ships full node_modules and serves
  // with `next start`, which standalone mode breaks (dynamic routes 404).
  // No transpilePackages: the web imports only TYPES from @superbot/shared
  // (erased at build) and inlines the tiny config metadata it needs in
  // lib/config-meta.ts, so no server-only deps (pino/zod) reach the client.
  typedRoutes: true,
};

export default nextConfig;
