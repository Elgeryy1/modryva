import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF egress guard for user-supplied fetch targets (RSS feeds, outbound
// webhooks). Without this, a tenant admin could point a feed/webhook at cloud
// metadata (169.254.169.254), loopback, or an internal Docker service (postgres,
// redis, api, ...) reachable from the worker — and, for RSS, have the response
// reflected back into the chat.
//
// LO QUE ESTE GUARDIA HACE, Y LO QUE NO:
//
// Valida en el momento del fetch (no al guardar la URL), y `fetchPublicOnly`
// revalida CADA salto de redirección, porque validar solo el primero es no
// validar nada: basta un 302 desde un host público hacia `postgres:5432`.
//
// NO cierra el DNS rebinding, y conviene decirlo aquí porque el comentario que
// había antes afirmaba que sí. `lookup()` y el `fetch()` posterior son dos
// resoluciones independientes: un nombre con TTL 0 que alterne público/privado
// se cuela por la ventana entre ambas. Cerrarlo de verdad exige validar en el
// socket (un `undici.Agent` con `connect.lookup` propio), lo que añade una
// dependencia al worker. Queda anotado como decisión pendiente, no como algo
// que este fichero ya resuelva.

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
  if (/^fe[89ab]/u.test(value)) return true; // fe80::/10, no solo "fe80"
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // ULA
  if (value.startsWith("64:ff9b:")) return true; // NAT64: falla cerrado

  // IPv4 mapeada, en LAS DOS grafías.
  //
  // Antes solo se miraba la de puntos (`::ffff:127.0.0.1`) y eso dejaba la
  // puerta abierta de par en par: `assertPublicHttpUrl` saca el host de
  // `new URL()`, y el parser WHATWG SIEMPRE reserializa IPv6 en hexadecimal
  // comprimido — nunca con puntos. O sea que la rama con puntos era código
  // muerto en el único camino que importa, y `http://[::ffff:127.0.0.1]/` se
  // convertía en `::ffff:7f00:1`, que no casaba con nada y pasaba.
  //
  // El test que lo tapaba llamaba a `isPrivateIp("::ffff:10.0.0.1")` a pelo,
  // saltándose el `new URL()` que es justo donde se rompía.
  const conPuntos = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(value);
  if (conPuntos?.[1]) return isPrivateIpv4(conPuntos[1]);
  const enHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(value);
  if (enHex?.[1] && enHex[2]) {
    const alto = Number.parseInt(enHex[1], 16);
    const bajo = Number.parseInt(enHex[2], 16);
    return isPrivateIpv4(
      `${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`,
    );
  }
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

/** Cuántos saltos se siguen antes de rendirse. `fetch` por defecto permite 20;
 * un feed legítimo no necesita ni cinco, y cada salto es otra oportunidad de
 * apuntar adentro. */
const MAX_SALTOS = 5;

/**
 * `fetch` que valida el destino en CADA salto, no solo el primero.
 *
 * El fallo que cierra: validar la URL y luego dejar que `fetch` siga los
 * redirects por su cuenta no es una defensa, es un trámite. El atacante
 * registra un host público de verdad —que pasa el guardia sin despeinarse— y
 * ese host responde `302 Location: http://postgres:5432/`. Ningún truco de
 * IPv6 hace falta, así que esto sigue abierto aunque se arregle la grafía.
 *
 * Un `307`/`308` conserva método y cuerpo, así que en la ruta de webhooks eso
 * era un POST interno con cabecera de firma incluida.
 */
export const fetchPublicOnly = async (
  raw: string,
  init: RequestInit = {},
): Promise<Response> => {
  let destino = raw;
  for (let salto = 0; salto <= MAX_SALTOS; salto += 1) {
    await assertPublicHttpUrl(destino);
    const respuesta = await fetch(destino, { ...init, redirect: "manual" });
    // 3xx sin `Location` no es una redirección que podamos seguir: se devuelve
    // tal cual y que decida quien llama.
    const location = respuesta.headers.get("location");
    if (respuesta.status < 300 || respuesta.status > 399 || !location) {
      return respuesta;
    }
    // `Location` puede ser relativa; se resuelve contra el destino actual y se
    // vuelve a validar desde cero en la siguiente vuelta.
    try {
      destino = new URL(location, destino).toString();
    } catch {
      throw new Error("ssrf-blocked: invalid-redirect");
    }
  }
  throw new Error("ssrf-blocked: too-many-redirects");
};
