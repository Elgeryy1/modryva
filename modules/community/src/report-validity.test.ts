import { describe, expect, it } from "vitest";
import { computeReportValidity } from "./report-validity.js";

describe("computeReportValidity", () => {
  it("returns all zeros for an empty batch", () => {
    expect(computeReportValidity([])).toEqual({
      total: 0,
      validCount: 0,
      falseCount: 0,
      validRatio: 0,
    });
  });

  it("yields ratio 1 for a single valid report", () => {
    expect(computeReportValidity([{ valid: true }])).toEqual({
      total: 1,
      validCount: 1,
      falseCount: 0,
      validRatio: 1,
    });
  });

  it("yields ratio 0 for a single false report", () => {
    expect(computeReportValidity([{ valid: false }])).toEqual({
      total: 1,
      validCount: 0,
      falseCount: 1,
      validRatio: 0,
    });
  });

  it("computes a half ratio for an even split", () => {
    expect(computeReportValidity([{ valid: true }, { valid: false }])).toEqual({
      total: 2,
      validCount: 1,
      falseCount: 1,
      validRatio: 0.5,
    });
  });

  it("rounds 2/3 up to 0.67", () => {
    expect(
      computeReportValidity([
        { valid: true },
        { valid: true },
        { valid: false },
      ]),
    ).toEqual({ total: 3, validCount: 2, falseCount: 1, validRatio: 0.67 });
  });

  it("rounds 1/3 down to 0.33", () => {
    expect(
      computeReportValidity([
        { valid: true },
        { valid: false },
        { valid: false },
      ]),
    ).toEqual({ total: 3, validCount: 1, falseCount: 2, validRatio: 0.33 });
  });

  it("rounds 1/8 to 0.13", () => {
    const reports: readonly { readonly valid: boolean }[] = [
      { valid: true },
      { valid: false },
      { valid: false },
      { valid: false },
      { valid: false },
      { valid: false },
      { valid: false },
      { valid: false },
    ];
    expect(computeReportValidity(reports)).toEqual({
      total: 8,
      validCount: 1,
      falseCount: 7,
      validRatio: 0.13,
    });
  });

  it("yields ratio 1 when every report is valid", () => {
    expect(
      computeReportValidity([
        { valid: true },
        { valid: true },
        { valid: true },
      ]),
    ).toEqual({ total: 3, validCount: 3, falseCount: 0, validRatio: 1 });
  });

  it("yields ratio 0 when every report is false", () => {
    expect(computeReportValidity([{ valid: false }, { valid: false }])).toEqual(
      { total: 2, validCount: 0, falseCount: 2, validRatio: 0 },
    );
  });

  it("is order-independent for the same multiset of outcomes", () => {
    const ascending = computeReportValidity([
      { valid: false },
      { valid: true },
      { valid: true },
    ]);
    const descending = computeReportValidity([
      { valid: true },
      { valid: true },
      { valid: false },
    ]);
    expect(ascending).toEqual(descending);
    expect(ascending.validRatio).toBe(0.67);
  });

  it("keeps validCount and falseCount summing to total", () => {
    const result = computeReportValidity([
      { valid: true },
      { valid: false },
      { valid: true },
      { valid: false },
      { valid: true },
    ]);
    expect(result.validCount + result.falseCount).toBe(result.total);
    expect(result).toEqual({
      total: 5,
      validCount: 3,
      falseCount: 2,
      validRatio: 0.6,
    });
  });
});
