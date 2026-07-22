import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF egress guard for user-supplied fetch targets (RSS feeds, outbound
// webhooks). Without this, a tenant admin could point a feed/webhook at cloud
// metadata (169.254.169.254), loopback, or an internal Docker service (postgres,
// redis, api, ...) reachable from the worker — and, for RSS, have the response
// reflected back into the chat. We resolve DNS at *fetch* time (not when the URL
// is saved) so a name that only later points at a private address — DNS
// rebinding — is still rejected.

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return true; // unparseable → treat as unsafe
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const value = ip.toLowerCase();
  if (value === "::1" || value === "::") return true; // loopback / unspecified
  if (value.startsWith("fe80")) return true; // link-local
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // ULA
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(value); // IPv4-mapped
  if (mapped?.[1]) return isPrivateIpv4(mapped[1]);
  return false;
};

/** True if `ip` is loopback/private/link-local/reserved (not publicly routable). */
export const isPrivateIp = (ip: string): boolean =>
  isIP(ip) === 6 ? isPrivateIpv6(ip) : isPrivateIpv4(ip);

/**
 * Throws unless `raw` is an http(s) URL whose host resolves ONLY to public
 * addresses. Every A/AAAA record is checked; if any is private the fetch is
 * refused (defends against a record set mixing a public and a private address).
 */
export const assertPublicHttpUrl = async (raw: string): Promise<void> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("ssrf-blocked: invalid-url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("ssrf-blocked: scheme");
  }
  const host = url.hostname.replace(/^\[|\]$/gu, ""); // strip IPv6 brackets
  if (isIP(host) !== 0) {
    if (isPrivateIp(host)) {
      throw new Error("ssrf-blocked: private-ip");
    }
    return;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error("ssrf-blocked: dns");
  }
  if (addresses.length === 0) {
    throw new Error("ssrf-blocked: dns-empty");
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error("ssrf-blocked: private-ip");
    }
  }
};
