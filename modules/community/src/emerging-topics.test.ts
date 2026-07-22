import { describe, expect, it } from "vitest";
import {
  detectDeadTopics,
  detectEmergingTopics,
  EMERGING_TOPICS_MIN_RECENT,
  type TopicCount,
} from "./emerging-topics.js";

const topic = (overrides: Partial<TopicCount> = {}): TopicCount => ({
  topic: "general",
  recent: 0,
  previous: 0,
  ...overrides,
});

describe("EMERGING_TOPICS_MIN_RECENT", () => {
  it("is a positive integer threshold", () => {
    expect(EMERGING_TOPICS_MIN_RECENT).toBe(3);
  });
});

describe("detectEmergingTopics", () => {
  it("flags a topic growing beyond previous * growthFactor", () => {
    const counts = [topic({ topic: "ia", recent: 20, previous: 5 })];
    expect(detectEmergingTopics(counts, 2)).toEqual(["ia"]);
  });

  it("does not flag a topic below the growth factor", () => {
    const counts = [topic({ topic: "ia", recent: 9, previous: 5 })];
    expect(detectEmergingTopics(counts, 2)).toEqual([]);
  });

  it("flags a topic exactly at previous * growthFactor", () => {
    const counts = [topic({ topic: "ia", recent: 10, previous: 5 })];
    expect(detectEmergingTopics(counts, 2)).toEqual(["ia"]);
  });

  it("requires the minimum recent count regardless of growth", () => {
    const counts = [topic({ topic: "nicho", recent: 2, previous: 0 })];
    expect(detectEmergingTopics(counts, 2)).toEqual([]);
  });

  it("flags a brand new topic (previous 0) once it reaches the minimum", () => {
    const counts = [
      topic({
        topic: "nuevo",
        recent: EMERGING_TOPICS_MIN_RECENT,
        previous: 0,
      }),
    ];
    expect(detectEmergingTopics(counts, 2)).toEqual(["nuevo"]);
  });

  it("treats a zero growth factor as minimum-only", () => {
    const counts = [topic({ topic: "ia", recent: 4, previous: 100 })];
    expect(detectEmergingTopics(counts, 0)).toEqual(["ia"]);
  });

  it("treats a negative growth factor as zero", () => {
    const counts = [topic({ topic: "ia", recent: 4, previous: 100 })];
    expect(detectEmergingTopics(counts, -5)).toEqual(["ia"]);
  });

  it("preserves input order and returns only matching topics", () => {
    const counts = [
      topic({ topic: "a", recent: 10, previous: 2 }),
      topic({ topic: "b", recent: 1, previous: 0 }),
      topic({ topic: "c", recent: 8, previous: 3 }),
    ];
    expect(detectEmergingTopics(counts, 2)).toEqual(["a", "c"]);
  });

  it("returns empty for empty input", () => {
    expect(detectEmergingTopics([], 2)).toEqual([]);
  });

  it("handles a large growth factor that nothing satisfies", () => {
    const counts = [topic({ topic: "ia", recent: 10, previous: 5 })];
    expect(detectEmergingTopics(counts, 100)).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const counts = [
      topic({ topic: "a", recent: 10, previous: 2 }),
      topic({ topic: "b", recent: 12, previous: 3 }),
    ];
    expect(detectEmergingTopics(counts, 2)).toEqual(
      detectEmergingTopics(counts, 2),
    );
  });
});

describe("detectDeadTopics", () => {
  it("flags a topic that dropped to zero recent mentions", () => {
    const counts = [topic({ topic: "viejo", recent: 0, previous: 8 })];
    expect(detectDeadTopics(counts)).toEqual(["viejo"]);
  });

  it("does not flag a topic that still has recent mentions", () => {
    const counts = [topic({ topic: "vivo", recent: 1, previous: 8 })];
    expect(detectDeadTopics(counts)).toEqual([]);
  });

  it("does not flag a topic that never had previous mentions", () => {
    const counts = [topic({ topic: "inexistente", recent: 0, previous: 0 })];
    expect(detectDeadTopics(counts)).toEqual([]);
  });

  it("preserves input order and returns only dead topics", () => {
    const counts = [
      topic({ topic: "a", recent: 0, previous: 5 }),
      topic({ topic: "b", recent: 3, previous: 5 }),
      topic({ topic: "c", recent: 0, previous: 2 }),
    ];
    expect(detectDeadTopics(counts)).toEqual(["a", "c"]);
  });

  it("returns empty for empty input", () => {
    expect(detectDeadTopics([])).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const counts = [
      topic({ topic: "a", recent: 0, previous: 5 }),
      topic({ topic: "b", recent: 0, previous: 9 }),
    ];
    expect(detectDeadTopics(counts)).toEqual(detectDeadTopics(counts));
  });
});
