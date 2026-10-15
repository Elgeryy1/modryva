import { describe, expect, it } from "vitest";
import {
  detectReactionAbuse,
  REACTION_ABUSE_THRESHOLD,
  type ReactionEvent,
} from "./reaction-abuse.js";

const NEGATIVE: readonly string[] = ["👎", "🤡", "💩"];

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const react = (overrides: Partial<ReactionEvent> = {}): ReactionEvent => ({
  targetMsgAuthorId: "author-1",
  emoji: "👎",
  ms: 0,
  ...overrides,
});

/** Genera `n` reacciones identicas (mismo autor, emoji e instante). */
const many = (
  n: number,
  overrides: Partial<ReactionEvent> = {},
): ReactionEvent[] => Array.from({ length: n }, () => react(overrides));

describe("detectReactionAbuse", () => {
  it("marca abuso cuando un autor alcanza el umbral", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD, { ms: 1_000 });
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({
      abused: true,
      targetId: "author-1",
      count: REACTION_ABUSE_THRESHOLD,
    });
  });

  it("no marca abuso justo por debajo del umbral", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD - 1, { ms: 1_000 });
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({
      abused: false,
      count: REACTION_ABUSE_THRESHOLD - 1,
    });
  });

  it("omite targetId cuando no hay abuso", () => {
    const result = detectReactionAbuse(
      many(2, { ms: 1_000 }),
      MINUTE,
      1_000,
      NEGATIVE,
    );
    expect(result.abused).toBe(false);
    expect("targetId" in result).toBe(false);
  });

  it("ignora emojis que no son negativos", () => {
    const reactions = [
      ...many(REACTION_ABUSE_THRESHOLD, { emoji: "❤️", ms: 1_000 }),
      react({ emoji: "👍", ms: 1_000 }),
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({ abused: false, count: 0 });
  });

  it("cuenta distintos emojis negativos hacia el mismo autor", () => {
    const reactions = [
      react({ emoji: "👎", ms: 1_000 }),
      react({ emoji: "🤡", ms: 1_100 }),
      react({ emoji: "💩", ms: 1_200 }),
      react({ emoji: "👎", ms: 1_300 }),
      react({ emoji: "🤡", ms: 1_400 }),
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 2_000, NEGATIVE);
    expect(result).toEqual({
      abused: true,
      targetId: "author-1",
      count: 5,
    });
  });

  it("descarta reacciones mas viejas que la ventana", () => {
    const reactions = [
      ...many(4, { ms: -100 }), // dentro de ventana (age 100 < MINUTE)
      ...many(3, { ms: -60_000 }), // fuera de ventana (age = MINUTE, excluida)
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 0, NEGATIVE);
    expect(result).toEqual({ abused: false, count: 4 });
  });

  it("trata la reaccion de antiguedad exactamente igual a la ventana como fuera", () => {
    // age = nowMs - ms = 60_000 = windowMs -> excluida
    const reactions = many(REACTION_ABUSE_THRESHOLD, { ms: 0 });
    const result = detectReactionAbuse(reactions, MINUTE, 60_000, NEGATIVE);
    expect(result).toEqual({ abused: false, count: 0 });
  });

  it("incluye la reaccion de antiguedad justo por debajo de la ventana", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD, { ms: 1 });
    const result = detectReactionAbuse(reactions, MINUTE, 60_000, NEGATIVE);
    expect(result.abused).toBe(true);
    expect(result.count).toBe(REACTION_ABUSE_THRESHOLD);
  });

  it("descarta reacciones futuras (ms mayor que nowMs)", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD, { ms: 5_000 });
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({ abused: false, count: 0 });
  });

  it("elige al autor mas atacado entre varios", () => {
    const reactions = [
      ...many(2, { targetMsgAuthorId: "a", ms: 1_000 }),
      ...many(REACTION_ABUSE_THRESHOLD + 1, {
        targetMsgAuthorId: "b",
        ms: 1_000,
      }),
      ...many(3, { targetMsgAuthorId: "c", ms: 1_000 }),
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({
      abused: true,
      targetId: "b",
      count: REACTION_ABUSE_THRESHOLD + 1,
    });
  });

  it("desempata a favor del primer autor que alcanza el maximo", () => {
    const reactions = [
      ...many(REACTION_ABUSE_THRESHOLD, {
        targetMsgAuthorId: "first",
        ms: 1_000,
      }),
      ...many(REACTION_ABUSE_THRESHOLD, {
        targetMsgAuthorId: "second",
        ms: 1_000,
      }),
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result.targetId).toBe("first");
  });

  it("devuelve sin abuso para lista vacia", () => {
    expect(detectReactionAbuse([], MINUTE, 1_000, NEGATIVE)).toEqual({
      abused: false,
      count: 0,
    });
  });

  it("no marca abuso cuando la lista de emojis negativos esta vacia", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD + 5, { ms: 1_000 });
    expect(detectReactionAbuse(reactions, MINUTE, 1_000, [])).toEqual({
      abused: false,
      count: 0,
    });
  });

  it("con ventana no positiva descarta todo", () => {
    const reactions = many(REACTION_ABUSE_THRESHOLD, { ms: 1_000 });
    expect(detectReactionAbuse(reactions, 0, 1_000, NEGATIVE)).toEqual({
      abused: false,
      count: 0,
    });
    expect(detectReactionAbuse(reactions, -10, 1_000, NEGATIVE)).toEqual({
      abused: false,
      count: 0,
    });
  });

  it("cuenta por autor sin mezclar objetivos aunque sumen mucho en total", () => {
    const reactions = [
      ...many(3, { targetMsgAuthorId: "a", ms: 1_000 }),
      ...many(3, { targetMsgAuthorId: "b", ms: 1_000 }),
    ];
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, NEGATIVE);
    expect(result).toEqual({ abused: false, count: 3 });
  });

  it("es determinista para entradas identicas", () => {
    const reactions = [
      ...many(REACTION_ABUSE_THRESHOLD, { targetMsgAuthorId: "x", ms: 1_000 }),
      react({ targetMsgAuthorId: "y", ms: 1_200 }),
    ];
    const first = detectReactionAbuse(reactions, MINUTE, 2_000, NEGATIVE);
    const second = detectReactionAbuse(reactions, MINUTE, 2_000, NEGATIVE);
    expect(first).toEqual(second);
  });

  it("usa la lista de emojis negativos provista y no una fija", () => {
    const custom: readonly string[] = ["🖕"];
    const reactions = many(REACTION_ABUSE_THRESHOLD, {
      emoji: "🖕",
      ms: 1_000,
    });
    const result = detectReactionAbuse(reactions, MINUTE, 1_000, custom);
    expect(result).toEqual({
      abused: true,
      targetId: "author-1",
      count: REACTION_ABUSE_THRESHOLD,
    });
  });
});
