/**
 * VPN/proxy/risk lookup for a verifier's IP, via proxycheck.io. Best-effort and
 * opt-in (GUARDIAN_IP_INTEL_ENABLED) because it sends the IP to a third party.
 * Shown to STAFF as a fraud/multi-account signal; never a hard gate.
 */

export interface IpReputation {
  /** True when proxycheck flags the IP as a proxy/VPN/Tor/hosting exit. */
  readonly proxy: boolean;
  /** e.g. "VPN", "Proxy", "TOR", "Compromised Server" — or null when unknown. */
  readonly type: string | null;
  /** 0–100 risk score, or null when not returned. */
  readonly risk: number | null;
}

/**
 * Parses a proxycheck.io v2 response for a single IP. Returns null on any
 * non-`ok` status or missing entry. Pure and total — never throws.
 */
export const parseProxyCheckResponse = (
  ip: string,
  body: unknown,
): IpReputation | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const b = body as Record<string, unknown>;
  if (b.status !== "ok") {
    return null;
  }
  const entry = b[ip];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const e = entry as { proxy?: unknown; type?: unknown; risk?: unknown };
  return {
    proxy: e.proxy === "yes",
    type: typeof e.type === "string" ? e.type : null,
    risk: typeof e.risk === "number" ? e.risk : null,
  };
};

/**
 * Queries proxycheck.io for VPN/proxy/risk on an IP. Best-effort: a timeout,
 * network error, or unparseable body resolves to null (the STAFF report simply
 * omits the line). Works keyless (low rate); an optional apiKey raises limits.
 */
export const checkIpReputation = async (
  ip: string,
  opts: {
    readonly apiKey?: string | undefined;
    readonly timeoutMs?: number;
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<IpReputation | null> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const key = opts.apiKey ? `&key=${encodeURIComponent(opts.apiKey)}` : "";
  const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&risk=1${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 3000);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    return parseProxyCheckResponse(ip, await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
