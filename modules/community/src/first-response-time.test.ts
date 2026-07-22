import { describe, expect, it } from "vitest";
import { computeFirstResponseTimes } from "./first-response-time.js";

describe("computeFirstResponseTimes", () => {
  it("computes counts and odd-length median for responded cases", () => {
    expect(
      computeFirstResponseTimes([
        { openedMs: 0, firstStaffMs: 100 },
        { openedMs: 0, firstStaffMs: 300 },
        { openedMs: 0, firstStaffMs: 200 },
      ]),
    ).toEqual({ respondedCount: 3, pendingCount: 0, medianMs: 200 });
  });

  it("separates a pending case from a responded one", () => {
    expect(
      computeFirstResponseTimes([
        { openedMs: 10, firstStaffMs: 60 },
        { openedMs: 10, firstStaffMs: undefined },
      ]),
    ).toEqual({ respondedCount: 1, pendingCount: 1, medianMs: 50 });
  });

  it("returns zeros for an empty batch", () => {
    expect(computeFirstResponseTimes([])).toEqual({
      respondedCount: 0,
      pendingCount: 0,
      medianMs: 0,
    });
  });

  it("reports all pending with a zero median", () => {
    expect(
      computeFirstResponseTimes([
        { openedMs: 5, firstStaffMs: undefined },
        { openedMs: 7, firstStaffMs: undefined },
      ]),
    ).toEqual({ respondedCount: 0, pendingCount: 2, medianMs: 0 });
  });

  it("averages the two central durations for an even count", () => {
    expect(
      computeFirstResponseTimes([
        { openedMs: 0, firstStaffMs: 10 },
        { openedMs: 0, firstStaffMs: 20 },
        { openedMs: 0, firstStaffMs: 30 },
        { openedMs: 0, firstStaffMs: 40 },
      ]),
    ).toEqual({ respondedCount: 4, pendingCount: 0, medianMs: 25 });
  });

  it("ignores cases where the staff reply predates opening", () => {
    expect(
      computeFirstResponseTimes([
        { openedMs: 100, firstStaffMs: 50 },
        { openedMs: 0, firstStaffMs: 20 },
      ]),
    ).toEqual({ respondedCount: 1, pendingCount: 0, medianMs: 20 });
  });

  it("counts an instant reply as responded with zero duration", () => {
    expect(
      computeFirstResponseTimes([{ openedMs: 50, firstStaffMs: 50 }]),
    ).toEqual({ respondedCount: 1, pendingCount: 0, medianMs: 0 });
  });

  it("uses the single duration as the median for one responded case", () => {
    expect(
      computeFirstResponseTimes([{ openedMs: 1000, firstStaffMs: 1750 }]),
    ).toEqual({ respondedCount: 1, pendingCount: 0, medianMs: 750 });
  });

  it("is order-independent for the median", () => {
    const cases = [
      { openedMs: 0, firstStaffMs: 40 },
      { openedMs: 0, firstStaffMs: 10 },
      { openedMs: 0, firstStaffMs: 30 },
      { openedMs: 0, firstStaffMs: 20 },
      { openedMs: 0, firstStaffMs: 50 },
    ];
    const reversed = [...cases].reverse();
    expect(computeFirstResponseTimes(cases)).toEqual(
      computeFirstResponseTimes(reversed),
    );
    expect(computeFirstResponseTimes(cases).medianMs).toBe(30);
  });
});
