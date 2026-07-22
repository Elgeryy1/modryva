import { describe, expect, it } from "vitest";
import { collectDoubtfulDecisions } from "./decision-review.js";

describe("collectDoubtfulDecisions", () => {
  it("collects low-confidence decisions sorted by confidence", () => {
    expect(
      collectDoubtfulDecisions([
        { id: "a", confidence: 0.9 },
        { id: "b", confidence: 0.3 },
        { id: "c", confidence: 0.5 },
      ]),
    ).toEqual([
      { id: "b", confidence: 0.3 },
      { id: "c", confidence: 0.5 },
    ]);
  });

  it("excludes decisions at or above the threshold", () => {
    expect(collectDoubtfulDecisions([{ id: "a", confidence: 0.6 }])).toEqual(
      [],
    );
  });

  it("breaks confidence ties by id ascending", () => {
    expect(
      collectDoubtfulDecisions([
        { id: "z", confidence: 0.2 },
        { id: "a", confidence: 0.2 },
      ]).map((decision) => decision.id),
    ).toEqual(["a", "z"]);
  });

  it("honors a custom threshold", () => {
    expect(
      collectDoubtfulDecisions([{ id: "a", confidence: 0.7 }], {
        threshold: 0.8,
      }),
    ).toEqual([{ id: "a", confidence: 0.7 }]);
  });

  it("returns empty for no cases", () => {
    expect(collectDoubtfulDecisions([])).toEqual([]);
  });
});
