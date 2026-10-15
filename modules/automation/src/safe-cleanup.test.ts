import { describe, expect, it } from "vitest";
import { selectOldJobsForCleanup } from "./safe-cleanup.js";

const DAY = 24 * 60 * 60 * 1000;

describe("selectOldJobsForCleanup", () => {
  it("selects jobs older than the default max age", () => {
    const now = 100 * DAY;
    expect(
      selectOldJobsForCleanup(
        [
          { id: "old", createdMs: now - 40 * DAY },
          { id: "fresh", createdMs: now - 1 * DAY },
        ],
        now,
      ),
    ).toEqual(["old"]);
  });

  it("treats exactly max age as cleanable", () => {
    const now = 100 * DAY;
    expect(
      selectOldJobsForCleanup([{ id: "edge", createdMs: now - 30 * DAY }], now),
    ).toEqual(["edge"]);
  });

  it("honors a custom max age", () => {
    const now = 100 * DAY;
    expect(
      selectOldJobsForCleanup([{ id: "a", createdMs: now - 2 * DAY }], now, {
        maxAgeMs: DAY,
      }),
    ).toEqual(["a"]);
  });

  it("preserves input order", () => {
    const now = 100 * DAY;
    expect(
      selectOldJobsForCleanup(
        [
          { id: "b", createdMs: now - 40 * DAY },
          { id: "a", createdMs: now - 50 * DAY },
        ],
        now,
      ),
    ).toEqual(["b", "a"]);
  });

  it("returns empty when nothing is old enough", () => {
    expect(selectOldJobsForCleanup([{ id: "x", createdMs: 100 }], 200)).toEqual(
      [],
    );
  });
});
