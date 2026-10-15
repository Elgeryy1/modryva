import { describe, expect, it } from "vitest";
import { mapToRadar, type RadarAlert } from "./radar-map.js";

const alert = (overrides: Partial<RadarAlert> = {}): RadarAlert => ({
  id: "a",
  severity: 0.5,
  ageMs: 0,
  ...overrides,
});

describe("mapToRadar", () => {
  it("returns an empty array for no alerts", () => {
    expect(mapToRadar([])).toEqual([]);
  });

  it("places a single alert at angle 0", () => {
    const points = mapToRadar([alert({ id: "solo", severity: 0.7 })]);
    expect(points).toEqual([{ id: "solo", angle: 0, radius: 0.7 }]);
  });

  it("spreads angles uniformly over 0..360", () => {
    const points = mapToRadar([
      alert({ id: "a" }),
      alert({ id: "b" }),
      alert({ id: "c" }),
      alert({ id: "d" }),
    ]);
    expect(points.map((p) => p.angle)).toEqual([0, 90, 180, 270]);
  });

  it("spreads three alerts at 120 degree steps", () => {
    const points = mapToRadar([
      alert({ id: "a" }),
      alert({ id: "b" }),
      alert({ id: "c" }),
    ]);
    expect(points.map((p) => p.angle)).toEqual([0, 120, 240]);
  });

  it("keeps every angle below 360", () => {
    const points = mapToRadar(
      Array.from({ length: 8 }, (_, i) => alert({ id: `x${i}` })),
    );
    for (const p of points) {
      expect(p.angle).toBeGreaterThanOrEqual(0);
      expect(p.angle).toBeLessThan(360);
    }
  });

  it("preserves the input order in the output ids", () => {
    const points = mapToRadar([
      alert({ id: "first" }),
      alert({ id: "second" }),
      alert({ id: "third" }),
    ]);
    expect(points.map((p) => p.id)).toEqual(["first", "second", "third"]);
  });

  it("uses severity as radius when already in range", () => {
    const points = mapToRadar([
      alert({ id: "lo", severity: 0 }),
      alert({ id: "mid", severity: 0.42 }),
      alert({ id: "hi", severity: 1 }),
    ]);
    expect(points.map((p) => p.radius)).toEqual([0, 0.42, 1]);
  });

  it("clamps severity above 1 down to 1", () => {
    const points = mapToRadar([alert({ id: "over", severity: 5 })]);
    expect(points[0]?.radius).toBe(1);
  });

  it("clamps negative severity up to 0", () => {
    const points = mapToRadar([alert({ id: "under", severity: -3 })]);
    expect(points[0]?.radius).toBe(0);
  });

  it("treats NaN severity as radius 0", () => {
    const points = mapToRadar([alert({ id: "nan", severity: Number.NaN })]);
    expect(points[0]?.radius).toBe(0);
  });

  it("ignores ageMs when computing the mapping", () => {
    const withAge = mapToRadar([alert({ id: "a", severity: 0.3, ageMs: 999 })]);
    const withoutAge = mapToRadar([
      alert({ id: "a", severity: 0.3, ageMs: 0 }),
    ]);
    expect(withAge).toEqual(withoutAge);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      alert({ id: "a", severity: 0.1 }),
      alert({ id: "b", severity: 0.9 }),
    ];
    expect(mapToRadar(input)).toEqual(mapToRadar(input));
  });

  it("ignores the optional nowMsUnused parameter", () => {
    const input = [alert({ id: "a", severity: 0.5 })];
    expect(mapToRadar(input, 123_456)).toEqual(mapToRadar(input));
  });

  it("returns one point per input alert", () => {
    const input = Array.from({ length: 6 }, (_, i) =>
      alert({ id: `n${i}`, severity: i / 6 }),
    );
    expect(mapToRadar(input)).toHaveLength(6);
  });
});
