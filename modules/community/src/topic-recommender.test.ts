import { describe, expect, it } from "vitest";
import { recommendTopic, type TopicProfile } from "./topic-recommender.js";

const topic = (topicId: string, keywords: readonly string[]): TopicProfile => ({
  topicId,
  keywords,
});

const games = topic("games", ["juego", "partida", "consola", "steam"]);
const cooking = topic("cooking", ["receta", "cocina", "horno"]);
const tech = topic("tech", ["codigo", "bug", "deploy", "servidor"]);

describe("recommendTopic", () => {
  it("recommends the topic whose keyword appears in the text", () => {
    expect(
      recommendTopic("alguien quiere una partida?", [games, cooking]),
    ).toEqual({ topicId: "games", score: 1 });
  });

  it("scores one point per distinct matched keyword", () => {
    expect(
      recommendTopic("comparto una receta para el horno", [cooking, games]),
    ).toEqual({ topicId: "cooking", score: 2 });
  });

  it("picks the topic with the highest score", () => {
    const text =
      "el codigo tiene un bug al hacer deploy, y de paso una partida";
    expect(recommendTopic(text, [games, tech])).toEqual({
      topicId: "tech",
      score: 3,
    });
  });

  it("returns null when no keyword matches", () => {
    expect(
      recommendTopic("hola buenos dias a todos", [games, cooking]),
    ).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(recommendTopic("", [games])).toBeNull();
  });

  it("returns null for whitespace-only text", () => {
    expect(recommendTopic("   \n\t  ", [games])).toBeNull();
  });

  it("returns null when there are no topics", () => {
    expect(recommendTopic("una partida ya", [])).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(recommendTopic("QUIERO una PARTIDA", [games])).toEqual({
      topicId: "games",
      score: 1,
    });
  });

  it("matches ignoring diacritics in the text", () => {
    const t = topic("es", ["accion", "numero"]);
    expect(recommendTopic("mucha acción y un número", [t])).toEqual({
      topicId: "es",
      score: 2,
    });
  });

  it("matches ignoring diacritics in the keywords", () => {
    const t = topic("es", ["acción", "número"]);
    expect(recommendTopic("mucha accion y un numero", [t])).toEqual({
      topicId: "es",
      score: 2,
    });
  });

  it("matches whole words only, not partial substrings", () => {
    // "juego" must not match inside "juegos"? It should, as a phrase check is
    // whole-word: "juegos" normalizes to " juegos " which does not contain
    // " juego " with trailing space. Verify no partial match.
    expect(recommendTopic("los juegos molan", [games])).toBeNull();
  });

  it("matches a multi-word keyword phrase", () => {
    const t = topic("board", ["juego de mesa"]);
    expect(recommendTopic("tenemos un juego de mesa nuevo", [t])).toEqual({
      topicId: "board",
      score: 1,
    });
    expect(recommendTopic("un juego y una mesa", [t])).toBeNull();
  });

  it("counts duplicate keywords in a profile only once", () => {
    const t = topic("dup", ["gol", "gol", "gol"]);
    expect(recommendTopic("golazo... digo, gol", [t])).toEqual({
      topicId: "dup",
      score: 1,
    });
  });

  it("counts a keyword repeated in the text only once", () => {
    const t = topic("cook", ["receta"]);
    expect(recommendTopic("receta receta receta", [t])).toEqual({
      topicId: "cook",
      score: 1,
    });
  });

  it("ignores empty and whitespace-only keywords", () => {
    const t = topic("weird", ["", "   ", "steam"]);
    expect(recommendTopic("juego en steam", [t])).toEqual({
      topicId: "weird",
      score: 1,
    });
  });

  it("never recommends a topic with only non-matching keywords", () => {
    const t = topic("empty", ["", "   "]);
    expect(recommendTopic("juego en steam", [t])).toBeNull();
  });

  it("breaks ties in favor of the first topic in input order", () => {
    const a = topic("a", ["partida"]);
    const b = topic("b", ["consola"]);
    expect(recommendTopic("una partida en la consola", [a, b])).toEqual({
      topicId: "a",
      score: 1,
    });
    expect(recommendTopic("una partida en la consola", [b, a])).toEqual({
      topicId: "b",
      score: 1,
    });
  });

  it("matches keywords separated by punctuation in the text", () => {
    expect(recommendTopic("hay un bug, y otro deploy!", [tech])).toEqual({
      topicId: "tech",
      score: 2,
    });
  });

  it("handles a keyword containing punctuation via normalization", () => {
    const t = topic("net", ["c#", "node.js"]);
    // "c#" normalizes to " c " and "node.js" to " node js ".
    expect(recommendTopic("uso node js y algo de c en el back", [t])).toEqual({
      topicId: "net",
      score: 2,
    });
  });

  it("is deterministic across repeated calls", () => {
    const first = recommendTopic("una partida y una receta", [games, cooking]);
    const second = recommendTopic("una partida y una receta", [games, cooking]);
    expect(first).toEqual(second);
    expect(first).toEqual({ topicId: "games", score: 1 });
  });

  it("matches alphanumeric keywords", () => {
    const t = topic("plat", ["ps5", "xbox360"]);
    expect(recommendTopic("juego en la ps5 y en xbox360", [t])).toEqual({
      topicId: "plat",
      score: 2,
    });
  });
});
