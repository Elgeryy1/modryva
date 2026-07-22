import { describe, expect, it } from "vitest";
import { detectAbandonedGroup } from "./abandoned-group.js";

const DAY = 86_400_000;

describe("detectAbandonedGroup", () => {
  it("flags a long-idle but populated group as abandoned", () => {
    expect(
      detectAbandonedGroup({
        lastActivityMs: 0,
        nowMs: 40 * DAY,
        members: 100,
      }),
    ).toEqual({ abandoned: true, idleDays: 40, empty: false });
  });

  it("keeps a recently active populated group alive", () => {
    expect(
      detectAbandonedGroup({
        lastActivityMs: 0,
        nowMs: 10 * DAY,
        members: 100,
      }),
    ).toEqual({ abandoned: false, idleDays: 10, empty: false });
  });

  it("treats the exact idle-day threshold as abandoned", () => {
    expect(
      detectAbandonedGroup({ lastActivityMs: 0, nowMs: 30 * DAY, members: 50 }),
    ).toEqual({ abandoned: true, idleDays: 30, empty: false });
  });

  it("keeps a group one day short of the threshold alive", () => {
    expect(
      detectAbandonedGroup({ lastActivityMs: 0, nowMs: 29 * DAY, members: 50 }),
    ).toEqual({ abandoned: false, idleDays: 29, empty: false });
  });

  it("flags an empty group as abandoned even when recently active", () => {
    expect(
      detectAbandonedGroup({ lastActivityMs: 0, nowMs: 1 * DAY, members: 1 }),
    ).toEqual({ abandoned: true, idleDays: 1, empty: true });
  });

  it("treats zero members as empty", () => {
    expect(
      detectAbandonedGroup({ lastActivityMs: 0, nowMs: 0, members: 0 }),
    ).toEqual({ abandoned: true, idleDays: 0, empty: true });
  });

  it("clamps idleDays to zero when activity is in the future", () => {
    expect(
      detectAbandonedGroup({
        lastActivityMs: 100 * DAY,
        nowMs: 10 * DAY,
        members: 100,
      }),
    ).toEqual({ abandoned: false, idleDays: 0, empty: false });
  });

  it("floors partial days instead of rounding", () => {
    const almostFive = 5 * DAY - 1;
    expect(
      detectAbandonedGroup({
        lastActivityMs: 0,
        nowMs: almostFive,
        members: 100,
      }),
    ).toEqual({ abandoned: false, idleDays: 4, empty: false });
  });

  it("honors a custom idleDaysThreshold", () => {
    expect(
      detectAbandonedGroup(
        { lastActivityMs: 0, nowMs: 8 * DAY, members: 100 },
        { idleDaysThreshold: 7 },
      ),
    ).toEqual({ abandoned: true, idleDays: 8, empty: false });
  });

  it("honors a custom emptyMembersThreshold", () => {
    expect(
      detectAbandonedGroup(
        { lastActivityMs: 0, nowMs: 1 * DAY, members: 5 },
        { emptyMembersThreshold: 5 },
      ),
    ).toEqual({ abandoned: true, idleDays: 1, empty: true });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = {
      lastActivityMs: 3 * DAY,
      nowMs: 50 * DAY,
      members: 12,
    } as const;
    const first = detectAbandonedGroup(input);
    const second = detectAbandonedGroup(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ abandoned: true, idleDays: 47, empty: false });
  });
});
