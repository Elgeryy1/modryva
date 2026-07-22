import { describe, expect, it } from "vitest";
import {
  buildGroupTimeline,
  type GroupTimelineEvent,
} from "./group-timeline.js";

describe("buildGroupTimeline", () => {
  it("sorts events by atMs ascending", () => {
    const events: readonly GroupTimelineEvent[] = [
      { atMs: 300, title: "c" },
      { atMs: 100, title: "a" },
      { atMs: 200, title: "b" },
    ];
    expect(buildGroupTimeline(events)).toEqual([
      { atMs: 100, title: "a" },
      { atMs: 200, title: "b" },
      { atMs: 300, title: "c" },
    ]);
  });

  it("breaks ties on equal atMs by title ascending", () => {
    const events: readonly GroupTimelineEvent[] = [
      { atMs: 500, title: "zebra" },
      { atMs: 500, title: "alpha" },
      { atMs: 500, title: "mango" },
    ];
    expect(buildGroupTimeline(events)).toEqual([
      { atMs: 500, title: "alpha" },
      { atMs: 500, title: "mango" },
      { atMs: 500, title: "zebra" },
    ]);
  });

  it("returns an empty timeline for empty input", () => {
    expect(buildGroupTimeline([])).toEqual([]);
  });

  it("keeps a single event unchanged", () => {
    expect(buildGroupTimeline([{ atMs: 42, title: "fundacion" }])).toEqual([
      { atMs: 42, title: "fundacion" },
    ]);
  });

  it("does not mutate the input array", () => {
    const events: readonly GroupTimelineEvent[] = [
      { atMs: 2, title: "b" },
      { atMs: 1, title: "a" },
    ];
    const snapshot = [...events];
    buildGroupTimeline(events);
    expect(events).toEqual(snapshot);
  });

  it("returns a new array reference distinct from the input", () => {
    const events: readonly GroupTimelineEvent[] = [{ atMs: 1, title: "a" }];
    expect(buildGroupTimeline(events)).not.toBe(events);
  });

  it("is stable for events with identical atMs and title", () => {
    const first: GroupTimelineEvent = { atMs: 10, title: "dup" };
    const second: GroupTimelineEvent = { atMs: 10, title: "dup" };
    const result = buildGroupTimeline([first, second]);
    expect(result[0]).toBe(first);
    expect(result[1]).toBe(second);
  });

  it("handles negative and zero timestamps in order", () => {
    const events: readonly GroupTimelineEvent[] = [
      { atMs: 0, title: "cero" },
      { atMs: -100, title: "antes" },
      { atMs: 50, title: "despues" },
    ];
    expect(buildGroupTimeline(events)).toEqual([
      { atMs: -100, title: "antes" },
      { atMs: 0, title: "cero" },
      { atMs: 50, title: "despues" },
    ]);
  });

  it("produces the same ordering regardless of input order (determinism)", () => {
    const a: readonly GroupTimelineEvent[] = [
      { atMs: 2, title: "b" },
      { atMs: 1, title: "a" },
      { atMs: 2, title: "a" },
    ];
    const b: readonly GroupTimelineEvent[] = [
      { atMs: 2, title: "a" },
      { atMs: 2, title: "b" },
      { atMs: 1, title: "a" },
    ];
    const expected = [
      { atMs: 1, title: "a" },
      { atMs: 2, title: "a" },
      { atMs: 2, title: "b" },
    ];
    expect(buildGroupTimeline(a)).toEqual(expected);
    expect(buildGroupTimeline(b)).toEqual(expected);
  });
});
