import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./telegram.js", () => ({
  getInitData: () => "initdata-falso",
  getBotUsername: () => undefined,
  getActAsBotUsername: () => undefined,
}));

const { getGuardianVerifySession, postGuardianConsent } = await import(
  "./api.js"
);

/**
 * Las tres propiedades que sacaron a la gente del atasco del 2026-08-10, y que
 * no se pueden perder en una limpieza futura:
 *
 * 1. Cada petición de verificación va a una URL distinta. `cache: "no-store"`
 *    arregla lo que venga, pero no borra lo ya guardado: si el webview contesta
 *    desde su caché, la petición NO sale y da igual lo que diga el servidor.
 *    Cambiar la URL es lo único que obliga a preguntar de verdad.
 * 2. La petición pide explícitamente saltarse la caché.
 * 3. El token sigue viajando en cabecera. Es tentador usarlo como diferenciador
 *    —distingue a cada persona de sobra— y sería un error: acabaría en los logs
 *    de acceso y en el historial del navegador.
 */

type FetchEspia = (url: string, init: RequestInit) => Promise<Response>;

const espiarFetch = (status = 200, body: unknown = { ok: true }) => {
  const espia = vi.fn<FetchEspia>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", espia);
  return espia;
};

/** Estalla en vez de devolver `undefined`: una prueba que afirma sobre una
 * llamada que no ocurrió pasa por los motivos equivocados. */
const llamadaA = (espia: ReturnType<typeof espiarFetch>, indice: number) => {
  const llamada = espia.mock.calls[indice];
  if (!llamada) {
    throw new Error(`no hubo llamada nº ${indice} a fetch`);
  }
  return { url: llamada[0], init: llamada[1] };
};

const urlDe = (espia: ReturnType<typeof espiarFetch>, indice: number) =>
  llamadaA(espia, indice).url;

const initDe = (espia: ReturnType<typeof espiarFetch>, indice: number) =>
  llamadaA(espia, indice).init;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guardianFetch — una respuesta vieja no puede volver a colarse", () => {
  it("no repite URL entre dos peticiones a la misma ruta", async () => {
    const espia = espiarFetch();
    await getGuardianVerifySession("token-de-sesion");
    await getGuardianVerifySession("token-de-sesion");

    const primera = urlDe(espia, 0);
    const segunda = urlDe(espia, 1);
    expect(primera).toMatch(/^\/api\/v1\/guardian\/session\?_=.+/);
    expect(segunda).not.toBe(primera);
  });

  it("pide saltarse la caché en la propia petición", async () => {
    const espia = espiarFetch();
    await getGuardianVerifySession("token-de-sesion");
    expect(initDe(espia, 0).cache).toBe("no-store");
  });

  it("manda el token en cabecera y jamás en la URL", async () => {
    const espia = espiarFetch();
    await getGuardianVerifySession("token-de-sesion");

    expect(urlDe(espia, 0)).not.toContain("token-de-sesion");
    const headers = new Headers(initDe(espia, 0).headers);
    expect(headers.get("x-guardian-session")).toBe("token-de-sesion");
    expect(headers.get("authorization")).toBe("tma initdata-falso");
  });

  it("hace lo mismo con las peticiones que escriben, no solo con la lectura", async () => {
    const espia = espiarFetch(201);
    await postGuardianConsent("token-de-sesion", "v1");
    expect(urlDe(espia, 0)).toMatch(/^\/api\/v1\/guardian\/consent\?_=.+/);
    expect(initDe(espia, 0).cache).toBe("no-store");
  });

  // El código de error del servidor tiene que llegar intacto hasta la pantalla:
  // es lo que decide si a la persona se le dice "ya se completó" o "ha caducado,
  // vuelve a solicitar entrar".
  it("propaga el código de error del cuerpo, no el número de estado", async () => {
    espiarFetch(410, { error: "session-expired" });
    await expect(getGuardianVerifySession("token-de-sesion")).rejects.toThrow(
      "session-expired",
    );
  });
});
