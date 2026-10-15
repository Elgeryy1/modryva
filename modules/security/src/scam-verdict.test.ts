import { describe, expect, it } from "vitest";
import { extractDomains, judgeScam } from "./scam-verdict.js";

/**
 * Los siete detectores de estafa ya estaban probados; lo que NO existia era la
 * funcion que los junta con el motor de puntuacion. Eran dos mitades de algo
 * que no llamaba nadie.
 *
 * Lo que se fija aqui es el puente, y sobre todo el lado que hace daño: un
 * mensaje normal no puede acabar en la sala de STAFF.
 */

describe("extractDomains", () => {
  it("coge dominios con y sin esquema", () => {
    // Una estafa rara vez escribe "https://": escribe "bit.ly/x" a secas.
    expect(extractDomains("mira https://ejemplo.com y bit.ly/abc")).toEqual([
      "ejemplo.com",
      "bit.ly",
    ]);
  });

  it("no confunde un decimal con un dominio", () => {
    // "3.5" entrando como dominio envenenaria el recuento de acortadores.
    expect(extractDomains("subio un 3.5 por ciento")).toEqual([]);
  });

  it("no repite el mismo dominio", () => {
    expect(extractDomains("a.com y otra vez a.com")).toEqual(["a.com"]);
  });

  it("aguanta un texto sin nada", () => {
    expect(extractDomains("")).toEqual([]);
    expect(extractDomains("hola que tal")).toEqual([]);
  });
});

describe("judgeScam — lo que NO puede disparar", () => {
  it("un mensaje normal no dispara nada", () => {
    const v = judgeScam({ text: "buenas, alguien juega hoy?", hasUrl: false });
    expect(v.action).toBe("ignore");
    expect(v.triggered).toEqual([]);
  });

  it("un enlace legitimo por si solo no basta", () => {
    // Compartir un link es lo mas normal del mundo en un grupo.
    const v = judgeScam({
      text: "os dejo la guia en https://github.com/algo/repo",
      hasUrl: true,
    });
    expect(v.action).not.toBe("ban");
    expect(v.action).not.toBe("mute");
  });

  it("un texto vacio no revienta", () => {
    expect(() => judgeScam({ text: "", hasUrl: false })).not.toThrow();
  });
});

describe("judgeScam — lo que si", () => {
  it("acortadores encadenados suman", () => {
    const v = judgeScam({
      text: "premio aqui bit.ly/aaa y tambien tinyurl.com/bbb",
      hasUrl: true,
    });
    expect(v.score).toBeGreaterThan(0);
    expect(v.triggered.length).toBeGreaterThan(0);
  });

  it("el veredicto explica QUE disparo, no solo cuanto", () => {
    // Un aviso al STAFF que solo dice "score 4" no permite decidir nada.
    const v = judgeScam({
      text: "premio aqui bit.ly/aaa y tambien tinyurl.com/bbb",
      hasUrl: true,
    });
    expect(v.detalles.length).toBeGreaterThan(0);
  });

  it("es determinista", () => {
    const uno = judgeScam({ text: "bit.ly/a y tinyurl.com/b", hasUrl: true });
    const dos = judgeScam({ text: "bit.ly/a y tinyurl.com/b", hasUrl: true });
    expect(uno).toEqual(dos);
  });
});
