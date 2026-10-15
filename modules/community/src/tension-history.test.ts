import { describe, expect, it } from "vitest";
import { computeTensionByHour } from "./tension-history.js";

describe("computeTensionByHour", () => {
  it("averages tension per hour and rounds to 2 decimals", () => {
    expect(
      computeTensionByHour([
        { hourOfDay: 9, tension: 1 },
        { hourOfDay: 9, tension: 2 },
      ]),
    ).toEqual([{ hour: 9, avgTension: 1.5, samples: 2 }]);
  });

  it("returns an empty array for no events", () => {
    expect(computeTensionByHour([])).toEqual([]);
  });

  it("only includes hours that have samples", () => {
    expect(computeTensionByHour([{ hourOfDay: 0, tension: 5 }])).toEqual([
      { hour: 0, avgTension: 5, samples: 1 },
    ]);
  });

  it("sorts result by hour ascending regardless of input order", () => {
    const result = computeTensionByHour([
      { hourOfDay: 23, tension: 4 },
      { hourOfDay: 1, tension: 2 },
      { hourOfDay: 12, tension: 3 },
    ]);
    expect(result.map((r) => r.hour)).toEqual([1, 12, 23]);
  });

  it("rounds repeating decimals to 2 places", () => {
    expect(
      computeTensionByHour([
        { hourOfDay: 8, tension: 1 },
        { hourOfDay: 8, tension: 1 },
        { hourOfDay: 8, tension: 2 },
      ]),
    ).toEqual([{ hour: 8, avgTension: 1.33, samples: 3 }]);
  });

  it("accepts the boundary hours 0 and 23", () => {
    expect(
      computeTensionByHour([
        { hourOfDay: 0, tension: 2 },
        { hourOfDay: 23, tension: 6 },
      ]),
    ).toEqual([
      { hour: 0, avgTension: 2, samples: 1 },
      { hour: 23, avgTension: 6, samples: 1 },
    ]);
  });

  it("ignores events with out-of-range hours", () => {
    expect(
      computeTensionByHour([
        { hourOfDay: -1, tension: 9 },
        { hourOfDay: 24, tension: 9 },
        { hourOfDay: 5, tension: 4 },
      ]),
    ).toEqual([{ hour: 5, avgTension: 4, samples: 1 }]);
  });

  it("ignores events with non-integer hours or non-finite tension", () => {
    expect(
      computeTensionByHour([
        { hourOfDay: 10.5, tension: 3 },
        { hourOfDay: 11, tension: Number.NaN },
        { hourOfDay: 11, tension: Number.POSITIVE_INFINITY },
        { hourOfDay: 11, tension: 7 },
      ]),
    ).toEqual([{ hour: 11, avgTension: 7, samples: 1 }]);
  });

  it("handles negative-zero-producing averages cleanly", () => {
    expect(computeTensionByHour([{ hourOfDay: 3, tension: 0 }])).toEqual([
      { hour: 3, avgTension: 0, samples: 1 },
    ]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const events = [
      { hourOfDay: 14, tension: 5 },
      { hourOfDay: 2, tension: 1 },
      { hourOfDay: 14, tension: 7 },
    ] as const;
    const first = computeTensionByHour(events);
    const second = computeTensionByHour(events);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { hour: 2, avgTension: 1, samples: 1 },
      { hour: 14, avgTension: 6, samples: 2 },
    ]);
  });
});
