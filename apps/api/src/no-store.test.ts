import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registrarNoStore } from "./no-store.js";

/**
 * Lo que se prueba aquí no es "una ruta pone la cabecera" —eso lo cumpliría
 * también la versión rota, escribiéndola endpoint a endpoint— sino que la
 * llevan las respuestas que NADIE escribió: el 404 de una ruta inexistente, el
 * 500 de un handler que revienta y una respuesta cortada por otro hook antes de
 * llegar al controlador. Esas tres son las que se olvidan, y una de ellas (un
 * 410 del guard) fue la que se quedó pegada en el móvil de la gente.
 */
const montar = () => {
  const app = Fastify();
  registrarNoStore(app);
  return app;
};

/**
 * Sin timeout propio: manda el de `vitest.config.ts`, que son 30 s.
 *
 * Lo tuvo, y por un buen motivo: cuando se escribio, el defecto de vitest eran
 * 5000 ms y este fichero era el unico rojo de los 9.100 tests, porque lo que se
 * agotaba era el arranque de Fastify bajo contencion de E/S —el arbol esta
 * montado por SMB— y no el codigo que se prueba.
 *
 * Despues el config global subio a 30 s por ese mismo motivo, y entonces este
 * `20_000` dejo de ser un margen para ser un RECORTE: bajaba el techo justo en
 * el fichero que mas tarda. Volvio a salir rojo el 2026-08-25 con la suite
 * entera, y en seco tardo 16,7 s — tres segundos de margen, o sea ninguno.
 *
 * La leccion es que un timeout por fichero envejece mal: el global se ajusta
 * mirando la suite entera y este solo se mira cuando falla.
 */
describe("registrarNoStore", () => {
  it("la pone en una respuesta normal", async () => {
    const app = montar();
    app.get("/ok", async () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/ok" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("la pone en el 404 de una ruta que no existe", async () => {
    const app = montar();
    const res = await app.inject({ method: "GET", url: "/no-existe" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("la pone en el 500 de un handler que revienta", async () => {
    const app = montar();
    app.get("/boom", async () => {
      throw new Error("boom");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  // El caso del limitador global de server.ts: contesta desde otro hook, sin
  // que ningún controlador llegue a correr.
  it("la pone cuando otro hook corta la petición antes del controlador", async () => {
    const app = montar();
    app.addHook("onRequest", (_request, reply, done) => {
      reply.code(429).send({ error: "rate-limited" });
      done();
    });
    app.get("/ok", async () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/ok" });
    expect(res.statusCode).toBe(429);
    expect(res.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  // Y el orden importa: si se registrara después del hook que contesta, esa
  // respuesta saldría sin cabecera. Se comprueba al revés para que quede
  // escrito por qué en server.ts va el primero.
  it("registrado DESPUÉS de un hook que contesta, ya no llega a tiempo", async () => {
    const app = Fastify();
    app.addHook("onRequest", (_request, reply, done) => {
      reply.code(429).send({ error: "rate-limited" });
      done();
    });
    registrarNoStore(app);
    const res = await app.inject({ method: "GET", url: "/lo-que-sea" });
    expect(res.headers["cache-control"]).toBeUndefined();
    await app.close();
  });
});
