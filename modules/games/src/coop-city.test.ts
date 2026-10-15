import { describe, expect, it } from "vitest";
import { computeCoopCityProgress } from "./coop-city.js";

describe("computeCoopCityProgress", () => {
  it("sums resources and reaches 100 percent when the goal is met", () => {
    expect(
      computeCoopCityProgress(
        [
          { userId: 1, resources: 30 },
          { userId: 2, resources: 50 },
          { userId: 3, resources: 20 },
        ],
        100,
      ),
    ).toEqual({ total: 100, percent: 100, complete: true, topContributor: 2 });
  });

  it("returns empty progress with no contributions", () => {
    expect(computeCoopCityProgress([], 100)).toEqual({
      total: 0,
      percent: 0,
      complete: false,
      topContributor: undefined,
    });
  });

  it("guards a goal of zero without dividing", () => {
    expect(computeCoopCityProgress([{ userId: 1, resources: 10 }], 0)).toEqual({
      total: 10,
      percent: 0,
      complete: false,
      topContributor: 1,
    });
  });

  it("guards a negative goal", () => {
    expect(computeCoopCityProgress([{ userId: 4, resources: 5 }], -50)).toEqual(
      { total: 5, percent: 0, complete: false, topContributor: 4 },
    );
  });

  it("breaks a resources tie by the lowest userId", () => {
    expect(
      computeCoopCityProgress(
        [
          { userId: 5, resources: 40 },
          { userId: 2, resources: 40 },
          { userId: 7, resources: 10 },
        ],
        200,
      ),
    ).toEqual({ total: 90, percent: 45, complete: false, topContributor: 2 });
  });

  it("clamps percent to 100 when the goal is exceeded", () => {
    expect(
      computeCoopCityProgress([{ userId: 1, resources: 150 }], 100),
    ).toEqual({ total: 150, percent: 100, complete: true, topContributor: 1 });
  });

  it("rounds fractional percent to the nearest integer", () => {
    expect(computeCoopCityProgress([{ userId: 9, resources: 1 }], 3)).toEqual({
      total: 1,
      percent: 33,
      complete: false,
      topContributor: 9,
    });
  });

  it("is exactly complete at the boundary", () => {
    expect(computeCoopCityProgress([{ userId: 8, resources: 60 }], 60)).toEqual(
      { total: 60, percent: 100, complete: true, topContributor: 8 },
    );
  });

  it("picks the top contributor regardless of input order", () => {
    const ascending = computeCoopCityProgress(
      [
        { userId: 3, resources: 10 },
        { userId: 1, resources: 70 },
        { userId: 2, resources: 20 },
      ],
      100,
    );
    const descending = computeCoopCityProgress(
      [
        { userId: 2, resources: 20 },
        { userId: 1, resources: 70 },
        { userId: 3, resources: 10 },
      ],
      100,
    );
    expect(ascending.topContributor).toBe(1);
    expect(descending.topContributor).toBe(1);
    expect(ascending).toEqual(descending);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { userId: 11, resources: 15 },
      { userId: 12, resources: 25 },
    ] as const;
    expect(computeCoopCityProgress(input, 80)).toEqual(
      computeCoopCityProgress(input, 80),
    );
  });
});
