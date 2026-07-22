import { describe, expect, it } from "vitest";
import { computeHypeLevel, describeHypeLevel } from "./hype-meter.js";

describe("computeHypeLevel", () => {
  it("returns templado when current equals baseline (ratio 1)", () => {
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: 10 }),
    ).toEqual({
      ratio: 1,
      level: "templado",
    });
  });

  it("returns frio when current is below baseline", () => {
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: 5 }),
    ).toEqual({
      ratio: 0.5,
      level: "frio",
    });
  });

  it("returns caliente at the ratio-2 boundary", () => {
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: 20 }),
    ).toEqual({
      ratio: 2,
      level: "caliente",
    });
  });

  it("returns templado just below the ratio-2 boundary", () => {
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: 19 }),
    ).toEqual({
      ratio: 1.9,
      level: "templado",
    });
  });

  it("returns ardiendo at the ratio-4 boundary", () => {
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: 40 }),
    ).toEqual({
      ratio: 4,
      level: "ardiendo",
    });
  });

  it("rounds the ratio to 2 decimals", () => {
    expect(computeHypeLevel({ baselinePerHour: 3, currentPerHour: 1 })).toEqual(
      {
        ratio: 0.33,
        level: "frio",
      },
    );
  });

  it("treats a zero baseline as a cold reading", () => {
    expect(computeHypeLevel({ baselinePerHour: 0, currentPerHour: 5 })).toEqual(
      {
        ratio: 0,
        level: "frio",
      },
    );
  });

  it("clamps negative rates to zero", () => {
    expect(
      computeHypeLevel({ baselinePerHour: -10, currentPerHour: 5 }),
    ).toEqual({
      ratio: 0,
      level: "frio",
    });
    expect(
      computeHypeLevel({ baselinePerHour: 10, currentPerHour: -5 }),
    ).toEqual({
      ratio: 0,
      level: "frio",
    });
  });

  it("ignores non-finite rates", () => {
    expect(
      computeHypeLevel({ baselinePerHour: Number.NaN, currentPerHour: 5 }),
    ).toEqual({ ratio: 0, level: "frio" });
    expect(
      computeHypeLevel({
        baselinePerHour: 10,
        currentPerHour: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ ratio: 0, level: "frio" });
  });

  it("is deterministic across repeated calls", () => {
    const input = { baselinePerHour: 8, currentPerHour: 20 } as const;
    const first = computeHypeLevel(input);
    const second = computeHypeLevel(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ ratio: 2.5, level: "caliente" });
  });
});

describe("describeHypeLevel", () => {
  it("returns a distinct accented Spanish label for every level", () => {
    const levels = ["frio", "templado", "caliente", "ardiendo"] as const;
    const labels = levels.map((level) => describeHypeLevel(level));
    expect(new Set(labels).size).toBe(4);
    expect(describeHypeLevel("ardiendo")).toContain("Ardiendo");
    expect(describeHypeLevel("frio")).toContain("Frío");
  });
});
