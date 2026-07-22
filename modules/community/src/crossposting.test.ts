import { describe, expect, it } from "vitest";
import { detectCrossposting } from "./crossposting.js";

describe("detectCrossposting", () => {
  it("flags the same message across two topics", () => {
    expect(
      detectCrossposting([
        { topicId: 1, text: "Hola mundo" },
        { topicId: 2, text: "hola mundo" },
      ]),
    ).toEqual({
      matched: true,
      duplicates: [{ sample: "Hola mundo", topics: [1, 2] }],
    });
  });

  it("does not flag the same text repeated within a single topic", () => {
    expect(
      detectCrossposting([
        { topicId: 5, text: "repost" },
        { topicId: 5, text: "repost" },
      ]),
    ).toEqual({ matched: false, duplicates: [] });
  });

  it("returns an empty report for no messages", () => {
    expect(detectCrossposting([])).toEqual({ matched: false, duplicates: [] });
  });

  it("ignores blank and whitespace-only texts", () => {
    expect(
      detectCrossposting([
        { topicId: 1, text: "   " },
        { topicId: 2, text: "\t\n" },
      ]),
    ).toEqual({ matched: false, duplicates: [] });
  });

  it("collapses case and whitespace when grouping", () => {
    expect(
      detectCrossposting([
        { topicId: 1, text: "  HOLA   Mundo " },
        { topicId: 2, text: "hola mundo" },
      ]),
    ).toEqual({
      matched: true,
      duplicates: [{ sample: "HOLA   Mundo", topics: [1, 2] }],
    });
  });

  it("sorts topics ascending regardless of arrival order", () => {
    expect(
      detectCrossposting([
        { topicId: 5, text: "ping" },
        { topicId: 1, text: "ping" },
      ]),
    ).toEqual({
      matched: true,
      duplicates: [{ sample: "ping", topics: [1, 5] }],
    });
  });

  it("deduplicates repeated topics within a group", () => {
    expect(
      detectCrossposting([
        { topicId: 1, text: "eco" },
        { topicId: 1, text: "eco" },
        { topicId: 2, text: "eco" },
      ]),
    ).toEqual({
      matched: true,
      duplicates: [{ sample: "eco", topics: [1, 2] }],
    });
  });

  it("respects a higher minTopics threshold", () => {
    const report = detectCrossposting(
      [
        { topicId: 1, text: "spam" },
        { topicId: 2, text: "spam" },
        { topicId: 3, text: "spam" },
        { topicId: 4, text: "solo aqui" },
        { topicId: 5, text: "solo aqui" },
      ],
      { minTopics: 3 },
    );
    expect(report).toEqual({
      matched: true,
      duplicates: [{ sample: "spam", topics: [1, 2, 3] }],
    });
  });

  it("orders duplicates by topic count desc then sample asc", () => {
    const report = detectCrossposting([
      { topicId: 1, text: "alpha" },
      { topicId: 2, text: "alpha" },
      { topicId: 3, text: "beta" },
      { topicId: 4, text: "beta" },
      { topicId: 5, text: "zeta" },
      { topicId: 6, text: "zeta" },
      { topicId: 7, text: "zeta" },
    ]);
    expect(report).toEqual({
      matched: true,
      duplicates: [
        { sample: "zeta", topics: [5, 6, 7] },
        { sample: "alpha", topics: [1, 2] },
        { sample: "beta", topics: [3, 4] },
      ],
    });
  });

  it("treats minTopics below 1 as a floor of 1", () => {
    const report = detectCrossposting([{ topicId: 9, text: "solo" }], {
      minTopics: 0,
    });
    expect(report).toEqual({
      matched: true,
      duplicates: [{ sample: "solo", topics: [9] }],
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { topicId: 2, text: "dup" },
      { topicId: 1, text: "dup" },
    ] as const;
    expect(detectCrossposting(input)).toEqual(detectCrossposting(input));
  });
});
