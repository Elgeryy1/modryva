import { describe, expect, it } from "vitest";
import {
  formatLatency,
  latencyMsFor,
  localPartsIn,
  poleWindowFor,
  windowDayKey,
} from "./pole-window.js";

/**
 * What is pinned here is the part a daily ritual gets wrong: the two nights a
 * year when a local day is not 24 hours long, and the fact that a window must
 * be derived from the clock rather than from a job having run.
 *
 * Madrid moves on the last Sunday of March (02:00 -> 03:00) and of October
 * (03:00 -> 02:00). In 2026 those are the 29th and the 25th.
 */

const utc = (iso: string): Date => new Date(iso);

describe("poleWindowFor — ordinary days", () => {
  it("opens at local midnight by default", () => {
    // 12:00 local in Madrid in July (CEST, +2) is 10:00 UTC.
    const w = poleWindowFor(utc("2026-07-30T10:00:00Z"), "Europe/Madrid", 0);
    expect(w.startsAt.toISOString()).toBe("2026-07-29T22:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2026-07-30T22:00:00.000Z");
  });

  it("puts a moment before the reset in YESTERDAY's window", () => {
    // Reset at 06:00 local; it is 05:00 local, so the competition running is
    // still the previous day's.
    const w = poleWindowFor(utc("2026-07-30T03:00:00Z"), "Europe/Madrid", 360);
    expect(w.startsAt.toISOString()).toBe("2026-07-29T04:00:00.000Z");
    expect(windowDayKey(w)).toBe("2026-07-29");
  });

  it("always brackets the instant it was asked about", () => {
    for (const hour of [0, 1, 5, 11, 17, 23]) {
      const at = utc(`2026-07-30T${String(hour).padStart(2, "0")}:00:00Z`);
      const w = poleWindowFor(at, "Europe/Madrid", 0);
      expect(w.startsAt.getTime()).toBeLessThanOrEqual(at.getTime());
      expect(w.endsAt.getTime()).toBeGreaterThan(at.getTime());
    }
  });

  it("works in a zone that never changes its clocks", () => {
    const w = poleWindowFor(utc("2026-07-30T12:00:00Z"), "America/Bogota", 0);
    // Bogota is UTC-5 all year, so local midnight is 05:00 UTC.
    expect(w.startsAt.toISOString()).toBe("2026-07-30T05:00:00.000Z");
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(24 * 3600 * 1000);
  });

  it("works south of the equator, where DST runs the other way", () => {
    const w = poleWindowFor(utc("2026-07-30T00:00:00Z"), "Pacific/Auckland", 0);
    const local = localPartsIn(w.startsAt, "Pacific/Auckland");
    expect(local.hour).toBe(0);
    expect(local.minute).toBe(0);
  });
});

describe("poleWindowFor — the night the clocks go forward", () => {
  // 2026-03-29, Madrid: 02:00 becomes 03:00. Local 02:30 does not exist.
  it("makes that local day one hour SHORTER", () => {
    const before = poleWindowFor(
      utc("2026-03-29T10:00:00Z"),
      "Europe/Madrid",
      0,
    );
    expect(before.endsAt.getTime() - before.startsAt.getTime()).toBe(
      23 * 3600 * 1000,
    );
  });

  it("still opens exactly once when the reset time never happens", () => {
    // A reset of 02:30 on the day 02:30 is skipped: the window must still have
    // one unambiguous start, and it must contain the instant we asked about.
    const at = utc("2026-03-29T12:00:00Z");
    const w = poleWindowFor(at, "Europe/Madrid", 150);
    expect(w.startsAt.getTime()).toBeLessThanOrEqual(at.getTime());
    expect(w.endsAt.getTime()).toBeGreaterThan(at.getTime());
    // It lands just after the jump rather than silently falling back a day.
    expect(windowDayKey(w)).toBe("2026-03-29");
  });

  it("leaves no gap between the day before and the day of the change", () => {
    const before = poleWindowFor(
      utc("2026-03-28T12:00:00Z"),
      "Europe/Madrid",
      150,
    );
    const during = poleWindowFor(
      utc("2026-03-29T12:00:00Z"),
      "Europe/Madrid",
      150,
    );
    expect(before.endsAt.toISOString()).toBe(during.startsAt.toISOString());
  });
});

describe("poleWindowFor — the night the clocks go back", () => {
  // 2026-10-25, Madrid: 03:00 becomes 02:00. Local 02:30 happens twice.
  it("makes that local day one hour LONGER", () => {
    const w = poleWindowFor(utc("2026-10-25T12:00:00Z"), "Europe/Madrid", 0);
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(25 * 3600 * 1000);
  });

  it("picks ONE of the two occurrences of an ambiguous reset time", () => {
    const at = utc("2026-10-25T12:00:00Z");
    const w = poleWindowFor(at, "Europe/Madrid", 150);
    const local = localPartsIn(w.startsAt, "Europe/Madrid");
    expect(local.hour).toBe(2);
    expect(local.minute).toBe(30);
    expect(w.startsAt.getTime()).toBeLessThanOrEqual(at.getTime());
  });

  it("leaves no gap across the change either", () => {
    const before = poleWindowFor(
      utc("2026-10-24T12:00:00Z"),
      "Europe/Madrid",
      150,
    );
    const during = poleWindowFor(
      utc("2026-10-25T12:00:00Z"),
      "Europe/Madrid",
      150,
    );
    expect(before.endsAt.toISOString()).toBe(during.startsAt.toISOString());
  });
});

describe("poleWindowFor — chained across a whole DST week", () => {
  it("covers every hour exactly once, with no overlap and no hole", () => {
    // Walk hour by hour through the spring change and assert the windows form
    // a partition: each hour sits in one window, and consecutive windows meet.
    const start = utc("2026-03-27T00:00:00Z").getTime();
    const seen = new Map<string, { start: number; end: number }>();
    for (let h = 0; h < 24 * 5; h += 1) {
      const at = new Date(start + h * 3600 * 1000);
      const w = poleWindowFor(at, "Europe/Madrid", 0);
      expect(w.startsAt.getTime()).toBeLessThanOrEqual(at.getTime());
      expect(w.endsAt.getTime()).toBeGreaterThan(at.getTime());
      const key = windowDayKey(w);
      const prior = seen.get(key);
      if (prior) {
        // The same local day must always yield the very same window.
        expect(prior.start).toBe(w.startsAt.getTime());
        expect(prior.end).toBe(w.endsAt.getTime());
      } else {
        seen.set(key, {
          start: w.startsAt.getTime(),
          end: w.endsAt.getTime(),
        });
      }
    }
    const ordered = [...seen.values()].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i += 1) {
      // No hole, no overlap.
      expect(ordered[i]?.start).toBe(ordered[i - 1]?.end);
    }
  });
});

describe("latency", () => {
  it("measures from the window opening", () => {
    const w = poleWindowFor(utc("2026-07-30T10:00:00Z"), "Europe/Madrid", 0);
    expect(latencyMsFor(w, utc("2026-07-29T22:00:02.400Z"))).toBe(2400);
  });

  it("never goes negative", () => {
    // Defensive: a clock that jumps backwards must not poison "fastest ever".
    const w = poleWindowFor(utc("2026-07-30T10:00:00Z"), "Europe/Madrid", 0);
    expect(latencyMsFor(w, utc("2026-07-29T21:00:00Z"))).toBe(0);
  });

  it("follows the magnitude with the unit", () => {
    expect(formatLatency(840)).toBe("840 ms");
    expect(formatLatency(2400)).toBe("2,4 s");
    expect(formatLatency(90_000)).toBe("1 min");
    expect(formatLatency(3_600_000)).toBe("1 h");
    expect(formatLatency(32_400_000)).toBe("9 h");
    expect(formatLatency(5_400_000)).toBe("1 h 30 min");
  });
});
