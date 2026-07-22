import { describe, expect, it } from "vitest";
import { resolveActivityPrediction } from "./activity-prediction.js";

describe("resolveActivityPrediction", () => {
  it("marks predictions within tolerance as winners", () => {
    expect(
      resolveActivityPrediction(
        [
          { userId: 1, predicted: 102 },
          { userId: 2, predicted: 120 },
        ],
        100,
      ),
    ).toEqual([
      { userId: 1, diff: 2, won: true },
      { userId: 2, diff: 20, won: false },
    ]);
  });

  it("sorts by diff ascending then userId ascending", () => {
    expect(
      resolveActivityPrediction(
        [
          { userId: 5, predicted: 100 },
          { userId: 3, predicted: 100 },
        ],
        100,
      ).map((outcome) => outcome.userId),
    ).toEqual([3, 5]);
  });

  it("treats the tolerance edge as a win", () => {
    expect(
      resolveActivityPrediction([{ userId: 1, predicted: 105 }], 100)[0]?.won,
    ).toBe(true);
  });

  it("honors a custom tolerance", () => {
    expect(
      resolveActivityPrediction([{ userId: 1, predicted: 110 }], 100, {
        tolerance: 10,
      })[0]?.won,
    ).toBe(true);
  });

  it("returns empty for no predictions", () => {
    expect(resolveActivityPrediction([], 100)).toEqual([]);
  });
});
