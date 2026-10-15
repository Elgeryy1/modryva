import { describe, expect, it } from "vitest";
import {
  crossedMilestone,
  formatMilestone,
  MEMBER_MILESTONES,
} from "./milestones.js";

describe("MEMBER_MILESTONES", () => {
  it("exposes the celebrated milestones in ascending order", () => {
    expect([...MEMBER_MILESTONES]).toEqual([100, 500, 1000, 5000, 10000]);
  });

  it("is strictly ascending", () => {
    for (let i = 1; i < MEMBER_MILESTONES.length; i += 1) {
      const prev = MEMBER_MILESTONES[i - 1] ?? 0;
      const cur = MEMBER_MILESTONES[i] ?? 0;
      expect(cur).toBeGreaterThan(prev);
    }
  });
});

describe("crossedMilestone", () => {
  it("returns the milestone when crossed exactly", () => {
    expect(crossedMilestone(99, 100)).toBe(100);
    expect(crossedMilestone(999, 1000)).toBe(1000);
  });

  it("returns the milestone when overshooting it", () => {
    expect(crossedMilestone(98, 105)).toBe(100);
    expect(crossedMilestone(4900, 5200)).toBe(5000);
  });

  it("returns the highest milestone when several are crossed at once", () => {
    expect(crossedMilestone(50, 1200)).toBe(1000);
    expect(crossedMilestone(0, 100000)).toBe(10000);
  });

  it("returns null when no milestone lies in the range", () => {
    expect(crossedMilestone(100, 150)).toBeNull();
    expect(crossedMilestone(1001, 4999)).toBeNull();
  });

  it("is exclusive on the lower bound", () => {
    expect(crossedMilestone(100, 200)).toBeNull();
    expect(crossedMilestone(1000, 1001)).toBeNull();
  });

  it("is inclusive on the upper bound", () => {
    expect(crossedMilestone(499, 500)).toBe(500);
  });

  it("returns null when the count does not grow", () => {
    expect(crossedMilestone(500, 500)).toBeNull();
    expect(crossedMilestone(600, 500)).toBeNull();
  });

  it("returns null when growth stays below the first milestone", () => {
    expect(crossedMilestone(0, 99)).toBeNull();
    expect(crossedMilestone(10, 50)).toBeNull();
  });

  it("returns null above the last milestone", () => {
    expect(crossedMilestone(10000, 20000)).toBeNull();
    expect(crossedMilestone(15000, 30000)).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    expect(crossedMilestone(90, 520)).toBe(crossedMilestone(90, 520));
    expect(crossedMilestone(90, 520)).toBe(500);
  });
});

describe("formatMilestone", () => {
  it("formats small milestones without a separator", () => {
    expect(formatMilestone(100)).toBe(
      "🎉 Ya somos 100 miembros! Gracias por construir esta comunidad.",
    );
    expect(formatMilestone(500)).toBe(
      "🎉 Ya somos 500 miembros! Gracias por construir esta comunidad.",
    );
  });

  it("adds a thousands separator", () => {
    expect(formatMilestone(1000)).toBe(
      "🎉 Ya somos 1.000 miembros! Gracias por construir esta comunidad.",
    );
    expect(formatMilestone(10000)).toBe(
      "🎉 Ya somos 10.000 miembros! Gracias por construir esta comunidad.",
    );
  });

  it("groups larger numbers in threes", () => {
    expect(formatMilestone(1234567)).toContain("1.234.567");
  });

  it("carries the accented user-facing copy", () => {
    expect(formatMilestone(100)).toContain("comunidad");
    expect(formatMilestone(100)).toContain("🎉");
  });

  it("floors fractional counts", () => {
    expect(formatMilestone(1000.9)).toContain("1.000");
  });

  it("treats negative counts as zero", () => {
    expect(formatMilestone(-5)).toContain("Ya somos 0 miembros");
  });

  it("is deterministic for identical inputs", () => {
    expect(formatMilestone(5000)).toBe(formatMilestone(5000));
  });
});
