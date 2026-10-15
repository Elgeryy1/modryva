import { describe, expect, it } from "vitest";
import { classifyRemorse } from "./remorse-signals.js";

describe("classifyRemorse", () => {
  it("flags acceptance with hits in category order", () => {
    expect(classifyRemorse("Perdon, tienes razon, no volvera a pasar")).toEqual(
      {
        signal: "acepta",
        hits: ["perdon", "tienes razon", "no volvera a pasar"],
      },
    );
  });

  it("flags denial of the facts", () => {
    expect(classifyRemorse("Yo no fui, es mentira, no hice nada")).toEqual({
      signal: "niega",
      hits: ["yo no fui", "no hice nada", "es mentira"],
    });
  });

  it("lets hostility win over acceptance", () => {
    expect(classifyRemorse("Perdon pero el mod es un idiota")).toEqual({
      signal: "hostil",
      hits: ["idiota"],
    });
  });

  it("lets hostility win over denial", () => {
    expect(classifyRemorse("Es mentira, callate")).toEqual({
      signal: "hostil",
      hits: ["callate"],
    });
  });

  it("lets denial win over acceptance", () => {
    expect(classifyRemorse("Lo siento pero no fui yo, no hice nada")).toEqual({
      signal: "niega",
      hits: ["no fui yo", "no hice nada"],
    });
  });

  it("returns neutro for clean text", () => {
    expect(classifyRemorse("hola buenas tardes")).toEqual({
      signal: "neutro",
      hits: [],
    });
  });

  it("handles undefined", () => {
    expect(classifyRemorse(undefined)).toEqual({ signal: "neutro", hits: [] });
  });

  it("handles empty string", () => {
    expect(classifyRemorse("")).toEqual({ signal: "neutro", hits: [] });
  });

  it("normalizes accents and casing for hostile terms", () => {
    expect(classifyRemorse("¡Cállate, estúpido!")).toEqual({
      signal: "hostil",
      hits: ["estupido", "callate"],
    });
  });

  it("orders hits by category, not by text position", () => {
    expect(classifyRemorse("No volvera a pasar, perdon")).toEqual({
      signal: "acepta",
      hits: ["perdon", "no volvera a pasar"],
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = "Perdón pero eres un imbecil y es falso";
    const first = classifyRemorse(input);
    const second = classifyRemorse(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ signal: "hostil", hits: ["imbecil"] });
  });
});
