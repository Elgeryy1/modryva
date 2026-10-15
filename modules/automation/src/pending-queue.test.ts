import { describe, expect, it } from "vitest";
import { computeQueuePosition } from "./pending-queue.js";

describe("computeQueuePosition", () => {
  it("returns a 1-based position for a queued id", () => {
    expect(computeQueuePosition(["a", "b", "c"], "b")).toEqual({
      position: 2,
      total: 3,
      found: true,
    });
  });

  it("reports the head of the queue as position 1", () => {
    expect(computeQueuePosition(["a", "b"], "a").position).toBe(1);
  });

  it("returns -1 and found false for a missing id", () => {
    expect(computeQueuePosition(["a", "b"], "z")).toEqual({
      position: -1,
      total: 2,
      found: false,
    });
  });

  it("handles an empty queue", () => {
    expect(computeQueuePosition([], "a")).toEqual({
      position: -1,
      total: 0,
      found: false,
    });
  });

  it("matches the first occurrence of a duplicated id", () => {
    expect(computeQueuePosition(["a", "b", "a"], "a").position).toBe(1);
  });
});
