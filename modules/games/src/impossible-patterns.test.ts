import { describe, expect, it } from "vitest";
import { detectImpossiblePattern } from "./impossible-patterns.js";

describe("detectImpossiblePattern", () => {
  it("flags an inhuman win rate over enough plays", () => {
    expect(
      detectImpossiblePattern({ wins: 20, plays: 20, avgReactionMs: 300 }),
    ).toEqual({
      suspicious: true,
      reasons: ["🎯 Tasa de victorias imposible: 100% en 20 partidas"],
    });
  });

  it("flags an inhuman reaction time", () => {
    expect(
      detectImpossiblePattern({ wins: 5, plays: 50, avgReactionMs: 40 }),
    ).toEqual({
      suspicious: true,
      reasons: ["⚡ Tiempo de reacción inhumano: 40 ms de media"],
    });
  });

  it("reports win rate and reaction reasons in a stable order", () => {
    expect(
      detectImpossiblePattern({ wins: 48, plays: 50, avgReactionMs: 90 }),
    ).toEqual({
      suspicious: true,
      reasons: [
        "🎯 Tasa de victorias imposible: 96% en 50 partidas",
        "⚡ Tiempo de reacción inhumano: 90 ms de media",
      ],
    });
  });

  it("flags impossible records with more wins than plays", () => {
    expect(
      detectImpossiblePattern({ wins: 10, plays: 5, avgReactionMs: 300 }),
    ).toEqual({
      suspicious: true,
      reasons: ["🚫 Datos imposibles: hay más victorias que partidas"],
    });
  });

  it("accepts normal human play as not suspicious", () => {
    expect(
      detectImpossiblePattern({ wins: 10, plays: 30, avgReactionMs: 250 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("does not judge win rate with too few plays", () => {
    expect(
      detectImpossiblePattern({ wins: 19, plays: 19, avgReactionMs: 300 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("treats values exactly at the thresholds as human", () => {
    // 19/20 = 0.95, exactly the maximum plausible rate (not above it).
    expect(
      detectImpossiblePattern({ wins: 19, plays: 20, avgReactionMs: 300 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
    // 120 ms is exactly the minimum plausible reaction, so still human.
    expect(
      detectImpossiblePattern({ wins: 5, plays: 50, avgReactionMs: 120 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("ignores reaction time when it is not measured (zero)", () => {
    expect(
      detectImpossiblePattern({ wins: 5, plays: 50, avgReactionMs: 0 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("returns not suspicious for zero plays", () => {
    expect(
      detectImpossiblePattern({ wins: 0, plays: 0, avgReactionMs: 40 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("returns not suspicious for negative or non-finite input", () => {
    expect(
      detectImpossiblePattern({ wins: -1, plays: 10, avgReactionMs: 300 }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
    expect(
      detectImpossiblePattern({
        wins: 5,
        plays: 50,
        avgReactionMs: Number.NaN,
      }),
    ).toEqual({
      suspicious: false,
      reasons: [],
    });
  });

  it("honors custom thresholds", () => {
    const stats = { wins: 30, plays: 50, avgReactionMs: 300 };
    // With defaults a 60% win rate is perfectly human.
    expect(detectImpossiblePattern(stats)).toEqual({
      suspicious: false,
      reasons: [],
    });
    // With a stricter cap the same record becomes suspicious.
    expect(detectImpossiblePattern(stats, { maxWinRate: 0.5 })).toEqual({
      suspicious: true,
      reasons: ["🎯 Tasa de victorias imposible: 60% en 50 partidas"],
    });
  });

  it("is deterministic across repeated calls", () => {
    const stats = { wins: 49, plays: 50, avgReactionMs: 50 };
    const first = detectImpossiblePattern(stats);
    const second = detectImpossiblePattern(stats);
    expect(first).toEqual(second);
    expect(first).toEqual({
      suspicious: true,
      reasons: [
        "🎯 Tasa de victorias imposible: 98% en 50 partidas",
        "⚡ Tiempo de reacción inhumano: 50 ms de media",
      ],
    });
  });
});
