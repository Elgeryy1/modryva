import { describe, expect, it } from "vitest";
import { computeStaffResponseTimes } from "./staff-response-time.js";

describe("computeStaffResponseTimes", () => {
  it("averages response times per staff and rounds to integer", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 1, responseMs: 100 },
        { staffId: 1, responseMs: 201 },
      ]),
    ).toEqual([{ staffId: 1, avgMs: 151, count: 2 }]);
  });

  it("sorts by avgMs ascending", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 1, responseMs: 500 },
        { staffId: 2, responseMs: 100 },
      ]),
    ).toEqual([
      { staffId: 2, avgMs: 100, count: 1 },
      { staffId: 1, avgMs: 500, count: 1 },
    ]);
  });

  it("breaks avgMs ties by staffId ascending", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 3, responseMs: 200 },
        { staffId: 1, responseMs: 200 },
        { staffId: 2, responseMs: 200 },
      ]),
    ).toEqual([
      { staffId: 1, avgMs: 200, count: 1 },
      { staffId: 2, avgMs: 200, count: 1 },
      { staffId: 3, avgMs: 200, count: 1 },
    ]);
  });

  it("ignores negative responseMs samples", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 1, responseMs: -50 },
        { staffId: 1, responseMs: 300 },
      ]),
    ).toEqual([{ staffId: 1, avgMs: 300, count: 1 }]);
  });

  it("omits staff whose samples were all negative", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 7, responseMs: -1 },
        { staffId: 7, responseMs: -2 },
      ]),
    ).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(computeStaffResponseTimes([])).toEqual([]);
  });

  it("keeps a zero responseMs sample as valid", () => {
    expect(computeStaffResponseTimes([{ staffId: 4, responseMs: 0 }])).toEqual([
      { staffId: 4, avgMs: 0, count: 1 },
    ]);
  });

  it("rounds half up via Math.round", () => {
    expect(
      computeStaffResponseTimes([
        { staffId: 1, responseMs: 100 },
        { staffId: 1, responseMs: 101 },
      ]),
    ).toEqual([{ staffId: 1, avgMs: 101, count: 2 }]);
  });

  it("is deterministic across repeated calls on the same input", () => {
    const input = [
      { staffId: 2, responseMs: 400 },
      { staffId: 1, responseMs: 400 },
      { staffId: 3, responseMs: 100 },
    ];
    const first = computeStaffResponseTimes(input);
    const second = computeStaffResponseTimes(input);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { staffId: 3, avgMs: 100, count: 1 },
      { staffId: 1, avgMs: 400, count: 1 },
      { staffId: 2, avgMs: 400, count: 1 },
    ]);
  });
});
