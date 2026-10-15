import { describe, expect, it } from "vitest";
import { computeTopicFriction } from "./topic-friction.js";

describe("computeTopicFriction", () => {
  it("computes friction as conflicts over mentions rounded to 2 decimals", () => {
    expect(
      computeTopicFriction([{ topic: "cripto", conflicts: 5, mentions: 10 }]),
    ).toEqual([{ topic: "cripto", friction: 0.5, level: "alto" }]);
  });

  it("rounds a repeating ratio to 2 decimals", () => {
    expect(
      computeTopicFriction([{ topic: "bolsa", conflicts: 1, mentions: 3 }]),
    ).toEqual([{ topic: "bolsa", friction: 0.33, level: "medio" }]);
  });

  it("assigns levels by threshold (bajo, medio, alto)", () => {
    expect(
      computeTopicFriction([
        { topic: "memes", conflicts: 1, mentions: 10 },
        { topic: "deportes", conflicts: 3, mentions: 10 },
        { topic: "politica", conflicts: 8, mentions: 10 },
      ]),
    ).toEqual([
      { topic: "politica", friction: 0.8, level: "alto" },
      { topic: "deportes", friction: 0.3, level: "medio" },
      { topic: "memes", friction: 0.1, level: "bajo" },
    ]);
  });

  it("treats the medio and alto boundaries as inclusive", () => {
    expect(
      computeTopicFriction([
        { topic: "limite-medio", conflicts: 2, mentions: 10 },
        { topic: "limite-alto", conflicts: 5, mentions: 10 },
      ]),
    ).toEqual([
      { topic: "limite-alto", friction: 0.5, level: "alto" },
      { topic: "limite-medio", friction: 0.2, level: "medio" },
    ]);
  });

  it("guards division by zero when there are no mentions", () => {
    expect(
      computeTopicFriction([{ topic: "nuevo", conflicts: 4, mentions: 0 }]),
    ).toEqual([{ topic: "nuevo", friction: 0, level: "bajo" }]);
  });

  it("sorts by friction descending", () => {
    const result = computeTopicFriction([
      { topic: "a", conflicts: 1, mentions: 10 },
      { topic: "b", conflicts: 9, mentions: 10 },
      { topic: "c", conflicts: 5, mentions: 10 },
    ]);
    expect(result.map((r) => r.topic)).toEqual(["b", "c", "a"]);
  });

  it("breaks friction ties by topic name ascending", () => {
    const result = computeTopicFriction([
      { topic: "cripto", conflicts: 5, mentions: 10 },
      { topic: "bolsa", conflicts: 1, mentions: 2 },
      { topic: "acciones", conflicts: 25, mentions: 50 },
    ]);
    expect(result.map((r) => r.topic)).toEqual(["acciones", "bolsa", "cripto"]);
    expect(result.every((r) => r.friction === 0.5)).toBe(true);
  });

  it("handles friction above 1 when conflicts exceed mentions", () => {
    expect(
      computeTopicFriction([{ topic: "drama", conflicts: 15, mentions: 10 }]),
    ).toEqual([{ topic: "drama", friction: 1.5, level: "alto" }]);
  });

  it("returns an empty array for empty input", () => {
    expect(computeTopicFriction([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { topic: "z", conflicts: 1, mentions: 10 },
      { topic: "a", conflicts: 9, mentions: 10 },
    ];
    const snapshot = input.map((e) => e.topic);
    computeTopicFriction(input);
    expect(input.map((e) => e.topic)).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { topic: "x", conflicts: 3, mentions: 10 },
      { topic: "y", conflicts: 7, mentions: 10 },
    ];
    expect(computeTopicFriction(input)).toEqual(computeTopicFriction(input));
  });
});
