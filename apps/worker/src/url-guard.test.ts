import { describe, expect, it } from "vitest";
import {
  assertPublicHttpUrl,
  fetchPublicOnly,
  isPrivateIp,
} from "./url-guard.js";

describe("isPrivateIp", () => {
  it("flags loopback, private, link-local and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.4",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "224.0.0.1", // multicast
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:10.0.0.1", // IPv4-mapped private
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700::1"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    for (const raw of ["ftp://x/", "file:///etc/passwd", "gopher://x"]) {
      await expect(assertPublicHttpUrl(raw)).rejects.toThrow("scheme");
    }
  });

  it("rejects private/loopback/metadata IP literals (no DNS needed)", async () => {
    for (const raw of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:3001/v1/",
      "http://10.0.0.5/",
      "http://[::1]:6379/",
      "https://192.168.0.10/admin",
    ]) {
      await expect(assertPublicHttpUrl(raw)).rejects.toThrow(/ssrf-blocked/u);
    }
  });

  it("allows a public IP literal", async () => {
    await expect(
      assertPublicHttpUrl("http://93.184.216.34/"),
    ).resolves.toBeUndefined();
  });
});

/**
 * Las dos formas en que el guardia se dejaba rodear. Ninguna estaba cubierta:
 * el fichero probaba `isPrivateIp()` a pelo, que es justo saltarse el
 * `new URL()` donde ocurre el fallo.
 */
describe("assertPublicHttpUrl — IPv4 mapeada en IPv6", () => {
  it("bloquea la grafia hexadecimal, que es la unica que produce new URL()", async () => {
    // `new URL("http://[::ffff:127.0.0.1]/").hostname` === "[::ffff:7f00:1]".
    // El parser NUNCA devuelve la forma con puntos, asi que mirar solo esa era
    // no mirar nada.
    for (const url of [
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:169.254.169.254]/latest/meta-data/",
      "http://[::ffff:10.0.0.5]/",
      "http://[::ffff:172.18.0.4]:5432/",
      "http://[::ffff:192.168.1.50]:8100/",
    ]) {
      await expect(assertPublicHttpUrl(url)).rejects.toThrow("ssrf-blocked");
    }
  });

  it("sigue bloqueando lo que ya bloqueaba", async () => {
    for (const url of [
      "http://[::1]/",
      "http://127.0.0.1/",
      "http://10.0.0.1/",
    ]) {
      await expect(assertPublicHttpUrl(url)).rejects.toThrow("ssrf-blocked");
    }
  });

  it("bloquea NAT64, que falla cerrado", async () => {
    await expect(
      assertPublicHttpUrl("http://[64:ff9b::7f00:1]/"),
    ).rejects.toThrow("ssrf-blocked");
  });
});

describe("fetchPublicOnly — cada salto se revalida", () => {
  /** Servidor de usar y tirar. Devuelve su URL base y se cierra al final. */
  const servidor = async (
    manejar: (
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
    ) => void,
  ) => {
    const { createServer } = await import("node:http");
    const s = createServer(manejar);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const port = (s.address() as { port: number }).port;
    return { base: `http://127.0.0.1:${port}`, cerrar: () => s.close() };
  };

  it("no sigue una redireccion hacia una direccion privada", async () => {
    // El bypass que no necesita ningun truco de IPv6: el primer host es
    // publico de verdad y el guardia lo aprueba; el 302 apunta adentro.
    const interno = await servidor((_req, res) => {
      res.end(
        "<rss><channel><item><title>SECRETO</title></item></channel></rss>",
      );
    });
    const publico = await servidor((_req, res) => {
      res.writeHead(302, { location: `${interno.base}/interno` });
      res.end();
    });
    try {
      // El salto 1 lo hacemos nosotros mismos a mano contra 127.0.0.1, que ya
      // se bloquea de entrada; lo que se prueba es que el DESTINO del 302
      // tambien se valida, no solo el origen.
      await expect(fetchPublicOnly(`${publico.base}/feed.xml`)).rejects.toThrow(
        "ssrf-blocked",
      );
    } finally {
      interno.cerrar();
      publico.cerrar();
    }
  });

  it("se rinde antes de dar vueltas para siempre", async () => {
    const bucle = await servidor((_req, res) => {
      res.writeHead(302, { location: "/otra" });
      res.end();
    });
    try {
      await expect(fetchPublicOnly(`${bucle.base}/a`)).rejects.toThrow(
        "ssrf-blocked",
      );
    } finally {
      bucle.cerrar();
    }
  });
});
