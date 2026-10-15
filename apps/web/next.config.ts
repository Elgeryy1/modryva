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
  // No third-party script origin: the Telegram SDK is served from 'self'
  // (see public/README-telegram-sdk.md).
  "script-src 'self' 'unsafe-inline'",
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
  // Transpiled so instrumentation.ts can reach initErrorTracking, a VALUE
  // import — without this Next cannot resolve the package's .js specifiers
  // from outside the app and the build fails outright.
  //
  // The rule this replaces still holds, and is now a rule rather than a side
  // effect: every client-side import from @superbot/shared must stay
  // `import type`. Those are erased at build, so the barrel — which re-exports
  // pino and zod — never reaches the browser. All four current importers
  // (config/guardian, its roster, dashboard-panel, lib/api) are type-only, and
  // the client bundle was checked for pino and zod after turning this on.
  // A future VALUE import from a "use client" file would quietly ship a logger
  // and a schema validator to a Mini App; keep inlining small constants in
  // lib/config-meta.ts instead.
  transpilePackages: ["@superbot/shared"],
  // @superbot/shared is TypeScript source using ESM specifiers ("./env.js"
  // pointing at env.ts), which is correct for Node's resolver and meaningless
  // to webpack's — it looks for a literal env.js and finds nothing.
  // transpilePackages alone does not fix this; it decides what gets compiled,
  // not how paths resolve.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  typedRoutes: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
