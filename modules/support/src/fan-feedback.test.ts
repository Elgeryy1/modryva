import { describe, expect, it } from "vitest";
import { summarizeFanFeedback } from "./fan-feedback.js";

describe("summarizeFanFeedback", () => {
  it("counts each sentiment and computes netScore", () => {
    expect(
      summarizeFanFeedback([
        { sentiment: "positivo" },
        { sentiment: "positivo" },
        { sentiment: "neutro" },
        { sentiment: "negativo" },
      ]),
    ).toEqual({ total: 4, positive: 2, neutral: 1, negative: 1, netScore: 1 });
  });

  it("returns all zeros for empty input", () => {
    expect(summarizeFanFeedback([])).toEqual({
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      netScore: 0,
    });
  });

  it("yields a negative netScore when negatives dominate", () => {
    expect(
      summarizeFanFeedback([
        { sentiment: "negativo" },
        { sentiment: "negativo" },
        { sentiment: "positivo" },
      ]),
    ).toEqual({
      total: 3,
      positive: 1,
      neutral: 2 - 2,
      negative: 2,
      netScore: -1,
    });
  });

  it("ignores neutral in netScore but counts it in total", () => {
    expect(
      summarizeFanFeedback([
        { sentiment: "neutro" },
        { sentiment: "neutro" },
        { sentiment: "neutro" },
      ]),
    ).toEqual({ total: 3, positive: 0, neutral: 3, negative: 0, netScore: 0 });
  });

  it("handles only positive feedback", () => {
    expect(
      summarizeFanFeedback([
        { sentiment: "positivo" },
        { sentiment: "positivo" },
      ]),
    ).toEqual({ total: 2, positive: 2, neutral: 0, negative: 0, netScore: 2 });
  });

  it("handles a single item", () => {
    expect(summarizeFanFeedback([{ sentiment: "negativo" }])).toEqual({
      total: 1,
      positive: 0,
      neutral: 0,
      negative: 1,
      netScore: -1,
    });
  });

  it("keeps total equal to positive + neutral + negative", () => {
    const summary = summarizeFanFeedback([
      { sentiment: "positivo" },
      { sentiment: "neutro" },
      { sentiment: "negativo" },
      { sentiment: "positivo" },
      { sentiment: "neutro" },
    ]);
    expect(summary.total).toBe(
      summary.positive + summary.neutral + summary.negative,
    );
    expect(summary).toEqual({
      total: 5,
      positive: 2,
      neutral: 2,
      negative: 1,
      netScore: 1,
    });
  });

  it("is deterministic and order-independent for the same multiset", () => {
    const a = summarizeFanFeedback([
      { sentiment: "positivo" },
      { sentiment: "negativo" },
      { sentiment: "neutro" },
    ]);
    const b = summarizeFanFeedback([
      { sentiment: "neutro" },
      { sentiment: "positivo" },
      { sentiment: "negativo" },
    ]);
    expect(a).toEqual(b);
    expect(a).toEqual({
      total: 3,
      positive: 1,
      neutral: 1,
      negative: 1,
      netScore: 0,
    });
  });
});
