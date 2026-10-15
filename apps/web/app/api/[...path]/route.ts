import { type NextRequest, NextResponse } from "next/server";

// Same-origin proxy: the browser only ever talks to the web origin; this handler
// forwards /api/v1/* to the api container over the internal Docker network.
// Restricted to /v1/*; status passed through verbatim. Never logs the body or
// the Authorization header (initData transits here).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProxyContext {
  params: Promise<{ path?: string[] }>;
}

/**
 * Ninguna respuesta que salga de aquí es cacheable, y decirlo UNA vez es la
 * única forma de que siga siendo verdad.
 *
 * `force-dynamic` impide que Next cachee esto en el servidor, pero no dice nada
 * del navegador, que es donde estaba el problema: sin `Cache-Control`, un 404 o
 * un 410 son cacheables por defecto, y este proxy no reenvía las cabeceras de la
 * API (solo el `content-type`), así que la suya no llegaba al cliente. La URL de
 * `GET /v1/guardian/session` es idéntica para todas las sesiones —lo que las
 * distingue es la cabecera `x-guardian-session`—, de modo que un 410 guardado
 * por el webview de Telegram se le respondía a esa persona en todas sus
 * verificaciones posteriores, en cualquier grupo, sin salir a la red.
 *
 * Envoltorio y no una línea repetida en cada `return`: este handler tiene cinco
 * salidas hoy y la siguiente la escribirá alguien que no habrá leído esto. La
 * cabecera se pone sobre lo que sea que devuelva —y sobre lo que lance, que si
 * no acabaría en la página de error de Next, sin cabecera y fuera de nuestro
 * control.
 */
const sinCache =
  (handler: (req: NextRequest, ctx: ProxyContext) => Promise<NextResponse>) =>
  async (req: NextRequest, ctx: ProxyContext): Promise<NextResponse> => {
    let response: NextResponse;
    try {
      response = await handler(req, ctx);
    } catch {
      response = NextResponse.json({ error: "proxy-failed" }, { status: 500 });
    }
    response.headers.set("cache-control", "no-store");
    return response;
  };

async function proxy(
  req: NextRequest,
  ctx: ProxyContext,
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
  // Client IP for Guardian's fraud/VPN-proxy signal. Cloudflare stamps it on
  // the request reaching this proxy (the X-Modryva-IP Transform Rule, or the
  // standard cf-connecting-ip / x-forwarded-for), but the api sits behind THIS
  // proxy so it never sees it unless we forward it. Resolve from whatever
  // header arrived and forward it as x-modryva-ip (what the api reads first).
  // Same trust rationale as cf-ipcountry above (the CF tunnel is the sole
  // ingress, so these values can't be spoofed by the client).
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp =
    req.headers.get("x-modryva-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("true-client-ip") ??
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() || null : null) ??
    req.headers.get("x-real-ip");
  if (clientIp) headers.set("x-modryva-ip", clientIp);

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
    // Bounded on purpose. Without a deadline a hung api container holds this
    // connection open, the browser's fetch never settles either, and the Mini
    // App sits on a loading screen with nothing to show and nothing to retry.
    // A 504 is a bad answer; no answer at all is worse.
    const upstream = await fetch(target, {
      ...init,
      signal: AbortSignal.timeout(25_000),
    });
    const respHeaders = new Headers();
    const responseContentType = upstream.headers.get("content-type");
    if (responseContentType) {
      respHeaders.set("content-type", responseContentType);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (error) {
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "upstream-timeout" : "upstream-unreachable" },
      { status: timedOut ? 504 : 502 },
    );
  }
}

const handler = sinCache(proxy);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
