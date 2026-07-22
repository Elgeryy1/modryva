import { type NextRequest, NextResponse } from "next/server";

// Same-origin proxy: the browser only ever talks to the web origin; this handler
// forwards /api/v1/* to the api container over the internal Docker network.
// Restricted to /v1/*; status passed through verbatim. Never logs the body or
// the Authorization header (initData transits here).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const base = process.env.API_INTERNAL_URL;
  if (!base) {
    return NextResponse.json({ error: "missing-api-url" }, { status: 503 });
  }

  const { path } = await ctx.params;
  const rel = (path ?? []).join("/");
  if (!rel.startsWith("v1/")) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const target = new URL(rel, base.endsWith("/") ? base : `${base}/`);
  target.search = new URL(req.url).search;

  // Minimal allowlist: forward only auth + content-type + the bot hint. Never
  // host/cookie/origin.
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const botUsername = req.headers.get("x-bot-username");
  if (botUsername) headers.set("x-bot-username", botUsername);
  const platformActAs = req.headers.get("x-platform-act-as-bot-username");
  if (platformActAs) {
    headers.set("x-platform-act-as-bot-username", platformActAs);
  }
  // Guardian Verification Mini App: the opaque session token is its own auth
  // proof (alongside Authorization: tma initData). Without forwarding it the
  // api-side GuardianSessionGuard rejects every request with
  // "missing-session-token". Not a secret to the api — it resolves server-side
  // to a session by SHA-256 hash.
  const guardianSession = req.headers.get("x-guardian-session");
  if (guardianSession) headers.set("x-guardian-session", guardianSession);
  // Guardian's country-requirement gate (IP-based only — never phone number
  // or GPS location): Cloudflare stamps this on every request its edge
  // proxies, quick tunnels included, so no extra geolocation lookup is
  // needed. Forwarded generically like the other identity headers above.
  // Trustworthy ONLY because docker-compose.yml binds the api/web ports to
  // 127.0.0.1 — the Cloudflare tunnel is the sole ingress, so nothing can
  // reach this route without Cloudflare having already stamped the real
  // value. See the same note in guardian-verify.controller.ts.
  const cfCountry = req.headers.get("cf-ipcountry");
  if (cfCountry) headers.set("cf-ipcountry", cfCountry);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };
  if (hasBody) {
    init.body = req.body;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(target, init);
    const respHeaders = new Headers();
    const responseContentType = upstream.headers.get("content-type");
    if (responseContentType) {
      respHeaders.set("content-type", responseContentType);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "upstream-unreachable" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
