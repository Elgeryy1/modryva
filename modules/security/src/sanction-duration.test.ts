import { describe, expect, it } from "vitest";
import { computeSanctionDurationMs } from "./sanction-duration.js";

describe("computeSanctionDurationMs", () => {
  it("sizes a minimal daytime sanction from gravity 1", () => {
    expect(
      computeSanctionDurationMs({ gravity: 1, recidivism: 0, hourOfDay: 12 }),
    ).toEqual({ durationMs: 300000, label: "Sanción de 5 minutos" });
  });

  it("scales the base duration by recidivism", () => {
    expect(
      computeSanctionDurationMs({ gravity: 3, recidivism: 2, hourOfDay: 14 }),
    ).toEqual({ durationMs: 7200000, label: "Sanción de 2 horas" });
  });

  it("adds a night surcharge and a multi-part Spanish label", () => {
    expect(
      computeSanctionDurationMs({ gravity: 3, recidivism: 0, hourOfDay: 2 }),
    ).toEqual({
      durationMs: 4500000,
      label: "Sanción de 1 hora y 15 minutos con recargo nocturno",
    });
  });

  it("formats day-length sanctions in singular Spanish", () => {
    expect(
      computeSanctionDurationMs({ gravity: 5, recidivism: 0, hourOfDay: 12 }),
    ).toEqual({ durationMs: 86400000, label: "Sanción de 1 día" });
  });

  it("increases monotonically with recidivism", () => {
    const light = computeSanctionDurationMs({
      gravity: 4,
      recidivism: 1,
      hourOfDay: 12,
    });
    const heavy = computeSanctionDurationMs({
      gravity: 4,
      recidivism: 3,
      hourOfDay: 12,
    });
    expect(light.durationMs).toBe(32400000);
    expect(heavy.durationMs).toBe(54000000);
    expect(heavy.durationMs).toBeGreaterThan(light.durationMs);
  });

  it("clamps gravity above 5 down to the maximum", () => {
    expect(
      computeSanctionDurationMs({ gravity: 99, recidivism: 0, hourOfDay: 12 }),
    ).toEqual(
      computeSanctionDurationMs({ gravity: 5, recidivism: 0, hourOfDay: 12 }),
    );
  });

  it("clamps gravity below 1 and non-finite gravity up to the minimum", () => {
    const expected = computeSanctionDurationMs({
      gravity: 1,
      recidivism: 0,
      hourOfDay: 12,
    });
    expect(
      computeSanctionDurationMs({ gravity: 0, recidivism: 0, hourOfDay: 12 }),
    ).toEqual(expected);
    expect(
      computeSanctionDurationMs({
        gravity: Number.NaN,
        recidivism: 0,
        hourOfDay: 12,
      }),
    ).toEqual(expected);
  });

  it("clamps negative recidivism to zero", () => {
    expect(
      computeSanctionDurationMs({ gravity: 2, recidivism: -5, hourOfDay: 12 }),
    ).toEqual(
      computeSanctionDurationMs({ gravity: 2, recidivism: 0, hourOfDay: 12 }),
    );
  });

  it("normalizes the hour with wraparound and honors the night boundary", () => {
    const wrapped = computeSanctionDurationMs({
      gravity: 3,
      recidivism: 0,
      hourOfDay: 25,
    });
    expect(wrapped.label).toContain("con recargo nocturno");
    expect(wrapped.durationMs).toBe(4500000);

    const nightEdge = computeSanctionDurationMs({
      gravity: 3,
      recidivism: 0,
      hourOfDay: 6,
    });
    const dayEdge = computeSanctionDurationMs({
      gravity: 3,
      recidivism: 0,
      hourOfDay: 7,
    });
    expect(nightEdge.durationMs).toBeGreaterThan(dayEdge.durationMs);
    expect(dayEdge).toEqual({
      durationMs: 3600000,
      label: "Sanción de 1 hora",
    });

    const negative = computeSanctionDurationMs({
      gravity: 3,
      recidivism: 0,
      hourOfDay: -1,
    });
    expect(negative).toEqual({
      durationMs: 3600000,
      label: "Sanción de 1 hora",
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { gravity: 4, recidivism: 2, hourOfDay: 3 };
    expect(computeSanctionDurationMs(input)).toEqual(
      computeSanctionDurationMs(input),
    );
  });
});
