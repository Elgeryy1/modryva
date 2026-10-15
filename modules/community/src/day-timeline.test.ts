import { describe, expect, it } from "vitest";
import {
  bucketDayTimeline,
  peakTimelineHour,
  type TimelineEvent,
} from "./day-timeline.js";

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Evento situado en la hora local `h` (con tzOffset 0) y kind dado. */
const at = (h: number, kind: string): TimelineEvent => ({
  ms: h * HOUR,
  kind,
});

describe("bucketDayTimeline", () => {
  it("always returns 24 buckets in ascending hour order", () => {
    const buckets = bucketDayTimeline([], 0);
    expect(buckets).toHaveLength(24);
    expect(buckets.map((b) => b.hour)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
  });

  it("is safe on empty input: all counts 0 and empty kinds", () => {
    const buckets = bucketDayTimeline([], 0);
    for (const bucket of buckets) {
      expect(bucket.count).toBe(0);
      expect(bucket.kinds).toEqual({});
    }
  });

  it("places an event at the start of epoch in hour 0", () => {
    const buckets = bucketDayTimeline([at(0, "join")], 0);
    expect(buckets[0]?.count).toBe(1);
    expect(buckets[0]?.kinds).toEqual({ join: 1 });
  });

  it("counts an event in its local hour", () => {
    const buckets = bucketDayTimeline([at(9, "msg")], 0);
    expect(buckets[9]?.count).toBe(1);
    expect(buckets[9]?.kinds).toEqual({ msg: 1 });
  });

  it("aggregates several events of the same kind in one hour", () => {
    const buckets = bucketDayTimeline(
      [at(9, "msg"), at(9, "msg"), at(9, "msg")],
      0,
    );
    expect(buckets[9]?.count).toBe(3);
    expect(buckets[9]?.kinds).toEqual({ msg: 3 });
  });

  it("breaks down mixed kinds within an hour", () => {
    const buckets = bucketDayTimeline(
      [at(12, "msg"), at(12, "join"), at(12, "msg")],
      0,
    );
    expect(buckets[12]?.count).toBe(3);
    expect(buckets[12]?.kinds).toEqual({ msg: 2, join: 1 });
  });

  it("distributes events across different hours", () => {
    const buckets = bucketDayTimeline([at(0, "a"), at(6, "b"), at(23, "c")], 0);
    expect(buckets[0]?.count).toBe(1);
    expect(buckets[6]?.count).toBe(1);
    expect(buckets[23]?.count).toBe(1);
    expect(buckets[1]?.count).toBe(0);
  });

  it("folds hours beyond a single day back into 0..23", () => {
    // 25h desde epoch = dia siguiente hora 1.
    const buckets = bucketDayTimeline([{ ms: 25 * HOUR, kind: "x" }], 0);
    expect(buckets[1]?.count).toBe(1);
    expect(buckets[0]?.count).toBe(0);
  });

  it("applies a positive tz offset shifting the local hour forward", () => {
    // ms=0 con +60min -> hora local 1.
    const buckets = bucketDayTimeline([{ ms: 0, kind: "x" }], 60);
    expect(buckets[1]?.count).toBe(1);
    expect(buckets[0]?.count).toBe(0);
  });

  it("applies a negative tz offset wrapping to the previous hour", () => {
    // ms=0 con -60min -> hora local 23.
    const buckets = bucketDayTimeline([{ ms: 0, kind: "x" }], -60);
    expect(buckets[23]?.count).toBe(1);
    expect(buckets[0]?.count).toBe(0);
  });

  it("handles fractional tz offsets (e.g. +30min)", () => {
    // Evento a las 9h30 UTC, +30min -> 10h00 local.
    const buckets = bucketDayTimeline(
      [{ ms: 9 * HOUR + 30 * MINUTE, kind: "x" }],
      30,
    );
    expect(buckets[10]?.count).toBe(1);
    expect(buckets[9]?.count).toBe(0);
  });

  it("keeps an event at the end of an hour in that same hour", () => {
    const buckets = bucketDayTimeline(
      [{ ms: 8 * HOUR + 59 * MINUTE, kind: "x" }],
      0,
    );
    expect(buckets[8]?.count).toBe(1);
    expect(buckets[9]?.count).toBe(0);
  });

  it("ignores events with non-finite ms", () => {
    const buckets = bucketDayTimeline(
      [
        { ms: Number.NaN, kind: "bad" },
        { ms: Number.POSITIVE_INFINITY, kind: "bad" },
        at(5, "ok"),
      ],
      0,
    );
    expect(buckets[5]?.count).toBe(1);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(1);
  });

  it("preserves the total event count across all buckets", () => {
    const events = [
      at(0, "a"),
      at(0, "b"),
      at(7, "a"),
      at(7, "a"),
      at(23, "c"),
    ];
    const buckets = bucketDayTimeline(events, 0);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(events.length);
  });

  it("is deterministic for identical inputs", () => {
    const events = [at(1, "a"), at(1, "b"), at(5, "a")];
    expect(bucketDayTimeline(events, 120)).toEqual(
      bucketDayTimeline(events, 120),
    );
  });

  it("does not share kind objects between buckets", () => {
    const buckets = bucketDayTimeline([at(1, "a"), at(2, "b")], 0);
    expect(buckets[1]?.kinds).toEqual({ a: 1 });
    expect(buckets[2]?.kinds).toEqual({ b: 1 });
    expect(buckets[0]?.kinds).toEqual({});
  });
});

describe("peakTimelineHour", () => {
  it("returns null when there are no events", () => {
    expect(peakTimelineHour(bucketDayTimeline([], 0))).toBeNull();
  });

  it("returns the single active hour", () => {
    expect(peakTimelineHour(bucketDayTimeline([at(14, "x")], 0))).toBe(14);
  });

  it("returns the busiest hour", () => {
    const events = [at(3, "a"), at(9, "a"), at(9, "b"), at(9, "c")];
    expect(peakTimelineHour(bucketDayTimeline(events, 0))).toBe(9);
  });

  it("breaks ties by choosing the earliest hour", () => {
    const events = [at(5, "a"), at(5, "b"), at(18, "a"), at(18, "b")];
    expect(peakTimelineHour(bucketDayTimeline(events, 0))).toBe(5);
  });
});
