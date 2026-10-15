import { describe, expect, it } from "vitest";
import {
  findGhostMembers,
  type MemberActivity,
  silenceCurveMs,
} from "./ghost-members.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const member = (overrides: Partial<MemberActivity> = {}): MemberActivity => ({
  userId: "u1",
  joinedMs: 0,
  messages: 0,
  ...overrides,
});

describe("findGhostMembers", () => {
  it("flags members joined before the grace window with zero messages", () => {
    const members = [member({ userId: "ghost", joinedMs: 0, messages: 0 })];
    expect(findGhostMembers(members, 2 * DAY, DAY)).toEqual(["ghost"]);
  });

  it("does not flag members still inside the grace window", () => {
    const members = [member({ userId: "fresh", joinedMs: DAY, messages: 0 })];
    expect(findGhostMembers(members, DAY + HOUR, DAY)).toEqual([]);
  });

  it("treats exactly graceMs elapsed as not-yet-ghost (strict >)", () => {
    const members = [member({ userId: "edge", joinedMs: 0, messages: 0 })];
    expect(findGhostMembers(members, DAY, DAY)).toEqual([]);
    expect(findGhostMembers(members, DAY + 1, DAY)).toEqual(["edge"]);
  });

  it("never flags members with at least one message", () => {
    const members = [member({ userId: "talker", joinedMs: 0, messages: 1 })];
    expect(findGhostMembers(members, 10 * DAY, DAY)).toEqual([]);
  });

  it("treats negative message counts as no activity", () => {
    const members = [member({ userId: "weird", joinedMs: 0, messages: -3 })];
    expect(findGhostMembers(members, 2 * DAY, DAY)).toEqual(["weird"]);
  });

  it("preserves input order and returns only matching userIds", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 0 }),
      member({ userId: "b", joinedMs: 0, messages: 5 }),
      member({ userId: "c", joinedMs: 0, messages: 0 }),
    ];
    expect(findGhostMembers(members, 2 * DAY, DAY)).toEqual(["a", "c"]);
  });

  it("returns empty for an empty roster", () => {
    expect(findGhostMembers([], 5 * DAY, DAY)).toEqual([]);
  });

  it("supports a zero grace window", () => {
    const members = [
      member({ userId: "x", joinedMs: 0, messages: 0 }),
      member({ userId: "y", joinedMs: 10, messages: 0 }),
    ];
    expect(findGhostMembers(members, 10, 0)).toEqual(["x"]);
  });

  it("is deterministic for identical inputs", () => {
    const members = [member({ userId: "g", joinedMs: 0, messages: 0 })];
    expect(findGhostMembers(members, 3 * DAY, DAY)).toEqual(
      findGhostMembers(members, 3 * DAY, DAY),
    );
  });
});

describe("silenceCurveMs", () => {
  it("returns the single delay when only one member qualifies", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 2, lastSeenMs: 5 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(5 * MINUTE);
  });

  it("returns the middle value for an odd count", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: MINUTE }),
      member({ userId: "b", joinedMs: 0, messages: 1, lastSeenMs: 3 * MINUTE }),
      member({ userId: "c", joinedMs: 0, messages: 1, lastSeenMs: 9 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(3 * MINUTE);
  });

  it("averages the two central values for an even count", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: 2 * MINUTE }),
      member({ userId: "b", joinedMs: 0, messages: 1, lastSeenMs: 4 * MINUTE }),
      member({ userId: "c", joinedMs: 0, messages: 1, lastSeenMs: 6 * MINUTE }),
      member({ userId: "d", joinedMs: 0, messages: 1, lastSeenMs: 8 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(5 * MINUTE);
  });

  it("computes the delay relative to each member's joinedMs", () => {
    const members = [
      member({
        userId: "a",
        joinedMs: 10 * MINUTE,
        messages: 1,
        lastSeenMs: 17 * MINUTE,
      }),
    ];
    expect(silenceCurveMs(members)).toBe(7 * MINUTE);
  });

  it("ignores members that never messaged", () => {
    const members = [
      member({ userId: "ghost", joinedMs: 0, messages: 0, lastSeenMs: HOUR }),
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: 2 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(2 * MINUTE);
  });

  it("ignores members without lastSeenMs even if they have messages", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 3 }),
      member({ userId: "b", joinedMs: 0, messages: 1, lastSeenMs: 4 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(4 * MINUTE);
  });

  it("ignores negative delays (lastSeen before joined)", () => {
    const members = [
      member({
        userId: "bad",
        joinedMs: 10 * MINUTE,
        messages: 1,
        lastSeenMs: 5 * MINUTE,
      }),
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: 6 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(6 * MINUTE);
  });

  it("returns null when no member qualifies", () => {
    const members = [
      member({ userId: "ghost", joinedMs: 0, messages: 0 }),
      member({ userId: "silent", joinedMs: 0, messages: 5 }),
    ];
    expect(silenceCurveMs(members)).toBeNull();
  });

  it("returns null for an empty roster", () => {
    expect(silenceCurveMs([])).toBeNull();
  });

  it("accepts a zero delay (messaged at the join instant)", () => {
    const members = [
      member({ userId: "a", joinedMs: 100, messages: 1, lastSeenMs: 100 }),
    ];
    expect(silenceCurveMs(members)).toBe(0);
  });

  it("does not mutate the input array order", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: 9 * MINUTE }),
      member({ userId: "b", joinedMs: 0, messages: 1, lastSeenMs: MINUTE }),
    ];
    silenceCurveMs(members);
    expect(members[0]?.userId).toBe("a");
    expect(members[1]?.userId).toBe("b");
  });

  it("is deterministic for identical inputs", () => {
    const members = [
      member({ userId: "a", joinedMs: 0, messages: 1, lastSeenMs: 3 * MINUTE }),
      member({ userId: "b", joinedMs: 0, messages: 1, lastSeenMs: 7 * MINUTE }),
    ];
    expect(silenceCurveMs(members)).toBe(silenceCurveMs(members));
  });
});
