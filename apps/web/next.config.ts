import type { NextConfig } from "next";

// Security headers for the only HTML-serving surface (the Telegram Mini App).
// @fastify/helmet covers the JSON APIs but not this Next.js app. React's auto-
// escaping is the primary XSS defence; this CSP is defence-in-depth. 'unsafe-
// inline' is required for Next's inline bootstrap/hydration scripts (a nonce-
// based CSP via middleware is a future hardening), but object-src/base-uri/
// form-action/frame-ancestors still constrain the dangerous vectors, and the
// Mini App stays embeddable only by Telegram's web client.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors https://web.telegram.org https://telegram.org",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // No `output: standalone`: the Docker image ships full node_modules and serves
  // with `next start`, which standalone mode breaks (dynamic routes 404).
  // No transpilePackages: the web imports only TYPES from @superbot/shared
  // (erased at build) and inlines the tiny config metadata it needs in
  // lib/config-meta.ts, so no server-only deps (pino/zod) reach the client.
  typedRoutes: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
