import { describe, expect, it } from "vitest";
import { detectCursedTopics, type TopicConflictStats } from "./cursed-topic.js";

const sample: readonly TopicConflictStats[] = [
  { topic: "politica", conflictCount: 8, threadCount: 10 },
  { topic: "religion", conflictCount: 5, threadCount: 10 },
  { topic: "deportes", conflictCount: 1, threadCount: 10 },
  { topic: "memes", conflictCount: 2, threadCount: 2 },
];

describe("detectCursedTopics", () => {
  it("flags topics over the default rate and thread thresholds", () => {
    expect(detectCursedTopics(sample)).toEqual([
      { topic: "politica", conflictRate: 0.8 },
      { topic: "religion", conflictRate: 0.5 },
    ]);
  });

  it("includes a topic whose rate exactly equals minRate", () => {
    const result = detectCursedTopics([
      { topic: "religion", conflictCount: 5, threadCount: 10 },
    ]);
    expect(result).toEqual([{ topic: "religion", conflictRate: 0.5 }]);
  });

  it("excludes topics below the minimum thread count", () => {
    const result = detectCursedTopics([
      { topic: "memes", conflictCount: 3, threadCount: 2 },
    ]);
    expect(result).toEqual([]);
  });

  it("accepts a topic at the exact minThreads boundary", () => {
    const result = detectCursedTopics([
      { topic: "vacunas", conflictCount: 2, threadCount: 3 },
    ]);
    expect(result).toEqual([{ topic: "vacunas", conflictRate: 0.67 }]);
  });

  it("rounds the conflict rate to two decimals", () => {
    const result = detectCursedTopics(
      [{ topic: "impuestos", conflictCount: 1, threadCount: 3 }],
      { minRate: 0.3 },
    );
    expect(result).toEqual([{ topic: "impuestos", conflictRate: 0.33 }]);
  });

  it("breaks rate ties by topic ascending", () => {
    const result = detectCursedTopics([
      { topic: "zebra", conflictCount: 6, threadCount: 10 },
      { topic: "alpha", conflictCount: 3, threadCount: 5 },
    ]);
    expect(result).toEqual([
      { topic: "alpha", conflictRate: 0.6 },
      { topic: "zebra", conflictRate: 0.6 },
    ]);
  });

  it("honours custom minRate and minThreads options", () => {
    const result = detectCursedTopics(sample, { minRate: 0.7, minThreads: 5 });
    expect(result).toEqual([{ topic: "politica", conflictRate: 0.8 }]);
  });

  it("guards against a zero thread count", () => {
    const result = detectCursedTopics(
      [{ topic: "fantasma", conflictCount: 0, threadCount: 0 }],
      { minRate: 0, minThreads: 0 },
    );
    expect(result).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectCursedTopics([])).toEqual([]);
  });

  it("is deterministic and does not mutate the input", () => {
    const input: readonly TopicConflictStats[] = [
      { topic: "religion", conflictCount: 5, threadCount: 10 },
      { topic: "politica", conflictCount: 8, threadCount: 10 },
    ];
    const first = detectCursedTopics(input);
    const second = detectCursedTopics(input);
    expect(first).toEqual(second);
    expect(input[0]?.topic).toBe("religion");
    expect(input[1]?.topic).toBe("politica");
  });
});
