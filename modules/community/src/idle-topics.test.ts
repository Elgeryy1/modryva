import { describe, expect, it } from "vitest";
import { DEFAULT_DEAD_AFTER_MS, detectIdleTopics } from "./idle-topics.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("detectIdleTopics", () => {
  it("flags idle topics sorted by idleMs descending", () => {
    const nowMs = 30 * DAY_MS;
    const topics = [
      { id: "a", lastActivityMs: nowMs - 10 * DAY_MS },
      { id: "b", lastActivityMs: nowMs - 2 * DAY_MS },
      { id: "c", lastActivityMs: nowMs - 20 * DAY_MS },
      { id: "d", lastActivityMs: nowMs },
    ];
    expect(detectIdleTopics(topics, nowMs)).toEqual([
      { id: "c", idleMs: 20 * DAY_MS },
      { id: "a", idleMs: 10 * DAY_MS },
    ]);
  });

  it("returns an empty list for no topics", () => {
    expect(detectIdleTopics([], 1000)).toEqual([]);
  });

  it("returns an empty list when every topic is still active", () => {
    const nowMs = 100 * DAY_MS;
    const topics = [
      { id: "x", lastActivityMs: nowMs - DAY_MS },
      { id: "y", lastActivityMs: nowMs - 3 * DAY_MS },
    ];
    expect(detectIdleTopics(topics, nowMs)).toEqual([]);
  });

  it("treats a topic idle exactly deadAfterMs as dead (inclusive boundary)", () => {
    const nowMs = 7 * DAY_MS;
    const topics = [
      { id: "exact", lastActivityMs: 0 },
      { id: "just-alive", lastActivityMs: 1 },
    ];
    expect(detectIdleTopics(topics, nowMs)).toEqual([
      { id: "exact", idleMs: DEFAULT_DEAD_AFTER_MS },
    ]);
  });

  it("honors a custom deadAfterMs threshold", () => {
    const nowMs = 10 * DAY_MS;
    const topics = [
      { id: "x", lastActivityMs: nowMs - 3 * DAY_MS },
      { id: "y", lastActivityMs: nowMs - DAY_MS },
    ];
    expect(
      detectIdleTopics(topics, nowMs, { deadAfterMs: 2 * DAY_MS }),
    ).toEqual([{ id: "x", idleMs: 3 * DAY_MS }]);
  });

  it("with deadAfterMs 0 flags every topic that is not in the future", () => {
    const nowMs = 5 * DAY_MS;
    const topics = [
      { id: "now", lastActivityMs: nowMs },
      { id: "past", lastActivityMs: nowMs - DAY_MS },
      { id: "future", lastActivityMs: nowMs + DAY_MS },
    ];
    expect(detectIdleTopics(topics, nowMs, { deadAfterMs: 0 })).toEqual([
      { id: "past", idleMs: DAY_MS },
      { id: "now", idleMs: 0 },
    ]);
  });

  it("never flags a topic whose activity is in the future", () => {
    const nowMs = 5 * DAY_MS;
    const topics = [{ id: "future", lastActivityMs: 10 * DAY_MS }];
    expect(detectIdleTopics(topics, nowMs)).toEqual([]);
  });

  it("preserves input order for topics with equal idle time", () => {
    const nowMs = 10 * DAY_MS;
    const topics = [
      { id: "first", lastActivityMs: nowMs - 8 * DAY_MS },
      { id: "second", lastActivityMs: nowMs - 8 * DAY_MS },
      { id: "third", lastActivityMs: nowMs - 8 * DAY_MS },
    ];
    expect(detectIdleTopics(topics, nowMs)).toEqual([
      { id: "first", idleMs: 8 * DAY_MS },
      { id: "second", idleMs: 8 * DAY_MS },
      { id: "third", idleMs: 8 * DAY_MS },
    ]);
  });

  it("is deterministic and does not mutate its input", () => {
    const nowMs = 30 * DAY_MS;
    const topics = [
      { id: "a", lastActivityMs: nowMs - 9 * DAY_MS },
      { id: "b", lastActivityMs: nowMs - DAY_MS },
      { id: "c", lastActivityMs: nowMs - 40 * DAY_MS },
    ];
    const snapshot = [
      { id: "a", lastActivityMs: nowMs - 9 * DAY_MS },
      { id: "b", lastActivityMs: nowMs - DAY_MS },
      { id: "c", lastActivityMs: nowMs - 40 * DAY_MS },
    ];
    const first = detectIdleTopics(topics, nowMs);
    const second = detectIdleTopics(topics, nowMs);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { id: "c", idleMs: 40 * DAY_MS },
      { id: "a", idleMs: 9 * DAY_MS },
    ]);
    expect(topics).toEqual(snapshot);
  });

  it("exposes a seven-day default threshold", () => {
    expect(DEFAULT_DEAD_AFTER_MS).toBe(7 * DAY_MS);
    expect(DEFAULT_DEAD_AFTER_MS).toBe(604_800_000);
  });

  it("falls back to the default threshold when options omit deadAfterMs", () => {
    const nowMs = 30 * DAY_MS;
    const topics = [
      { id: "a", lastActivityMs: nowMs - 8 * DAY_MS },
      { id: "b", lastActivityMs: nowMs - 6 * DAY_MS },
    ];
    expect(detectIdleTopics(topics, nowMs, {})).toEqual([
      { id: "a", idleMs: 8 * DAY_MS },
    ]);
  });
});
