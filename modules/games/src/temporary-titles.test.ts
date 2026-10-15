import { describe, expect, it } from "vitest";
import { assignTemporaryTitles } from "./temporary-titles.js";

describe("assignTemporaryTitles", () => {
  it("assigns titles to the top users in order", () => {
    expect(
      assignTemporaryTitles(
        [
          { userId: 1, score: 10 },
          { userId: 2, score: 30 },
          { userId: 3, score: 20 },
        ],
        ["MVP", "Segundo"],
      ),
    ).toEqual([
      { userId: 2, title: "MVP" },
      { userId: 3, title: "Segundo" },
    ]);
  });

  it("breaks score ties by userId ascending", () => {
    expect(
      assignTemporaryTitles(
        [
          { userId: 5, score: 10 },
          { userId: 2, score: 10 },
        ],
        ["Top"],
      ),
    ).toEqual([{ userId: 2, title: "Top" }]);
  });

  it("stops when titles run out", () => {
    expect(
      assignTemporaryTitles(
        [
          { userId: 1, score: 5 },
          { userId: 2, score: 4 },
        ],
        ["Solo"],
      ),
    ).toHaveLength(1);
  });

  it("returns empty when there are no titles or rankings", () => {
    expect(assignTemporaryTitles([], ["A"])).toEqual([]);
    expect(assignTemporaryTitles([{ userId: 1, score: 1 }], [])).toEqual([]);
  });
});
