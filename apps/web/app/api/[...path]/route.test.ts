import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route.js";

/**
 * El proxy es el único sitio por el que la Mini App habla con la API, así que
 * es el último punto donde se puede evitar que una respuesta se quede guardada
 * en el móvil de alguien. Estas pruebas recorren TODAS sus salidas —incluida la
 * que no existía cuando esto se escribió, la de un handler que revienta—
 * porque el fallo del 2026-08-10 no fue que la cabecera estuviera mal puesta,
 * sino que faltaba en una salida que nadie miró.
 */

const contexto = (...segmentos: string[]) => ({
  params: Promise.resolve({ path: segmentos }),
});

const peticion = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(url), { headers });

type FetchEspia = (url: URL, init: RequestInit) => Promise<Response>;

const respuestaDeArriba =
  (status: number, body: unknown): FetchEspia =>
  async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

const envOriginal = process.env.API_INTERNAL_URL;

beforeEach(() => {
  process.env.API_INTERNAL_URL = "http://api:3001/";
});

afterEach(() => {
  process.env.API_INTERNAL_URL = envOriginal;
  vi.unstubAllGlobals();
});

describe("proxy /api — ninguna respuesta es cacheable", () => {
  it("pasa un 410 de la API con no-store aunque la API no lo mandara", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchEspia>(
        respuestaDeArriba(410, { error: "session-not-active" }),
      ),
    );
    const res = await GET(
      peticion("http://web/api/v1/guardian/session"),
      contexto("v1", "guardian", "session"),
    );
    expect(res.status).toBe(410);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "session-not-active" });
  });

  it("la pone en el 503 de cuando falta API_INTERNAL_URL", async () => {
    process.env.API_INTERNAL_URL = "";
    const res = await GET(
      peticion("http://web/api/v1/guardian/session"),
      contexto("v1", "guardian", "session"),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("la pone en el 404 de una ruta fuera de /v1", async () => {
    const res = await GET(
      peticion("http://web/api/v2/nada"),
      contexto("v2", "nada"),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("la pone cuando la API no contesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchEspia>(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const res = await POST(
      peticion("http://web/api/v1/guardian/consent"),
      contexto("v1", "guardian", "consent"),
    );
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  // La salida que no existía: si el handler lanza, la respuesta la fabricaba
  // Next —una página de error, sin cabecera nuestra y fuera de nuestro control.
  it("la pone incluso si el propio handler revienta", async () => {
    const res = await GET(peticion("http://web/api/v1/loquesea"), {
      params: Promise.reject(new Error("params rotos")),
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("proxy /api — lo que reenvía", () => {
  it("lleva el token de sesión en la cabecera y NUNCA en la URL", async () => {
    const espia = vi.fn<FetchEspia>(respuestaDeArriba(200, { ok: true }));
    vi.stubGlobal("fetch", espia);
    await GET(
      peticion("http://web/api/v1/guardian/session?_=abc123", {
        "x-guardian-session": "token-secreto",
        authorization: "tma initdata",
      }),
      contexto("v1", "guardian", "session"),
    );
    const llamada = espia.mock.calls[0];
    if (!llamada) {
      throw new Error("el proxy no llegó a llamar a la API");
    }
    const [destino, init] = llamada;
    // El sufijo anticaché sí viaja (es lo que hace única a cada petición); el
    // token no puede acabar nunca en una URL, que es lo que se registra.
    expect(destino.toString()).toBe(
      "http://api:3001/v1/guardian/session?_=abc123",
    );
    expect(destino.toString()).not.toContain("token-secreto");
    const headers = new Headers(init.headers);
    expect(headers.get("x-guardian-session")).toBe("token-secreto");
    expect(headers.get("authorization")).toBe("tma initdata");
  });
});
