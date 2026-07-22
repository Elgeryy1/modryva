import { describe, expect, it } from "vitest";
import {
  DORMANT_DEFAULT_AFTER_MS,
  detectDormantMembers,
} from "./dormant-members.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

describe("detectDormantMembers", () => {
  it("detects members idle beyond the default window and sorts by idle desc", () => {
    const members = [
      { userId: 1, lastActiveMs: NOW - 20 * DAY },
      { userId: 2, lastActiveMs: NOW - 5 * DAY },
      { userId: 3, lastActiveMs: NOW - 14 * DAY },
      { userId: 4, lastActiveMs: NOW - 20 * DAY },
    ];
    expect(detectDormantMembers(members, NOW)).toEqual([
      { userId: 1, idleMs: 20 * DAY },
      { userId: 4, idleMs: 20 * DAY },
      { userId: 3, idleMs: 14 * DAY },
    ]);
  });

  it("exposes the default window as exactly 14 days", () => {
    expect(DORMANT_DEFAULT_AFTER_MS).toBe(14 * DAY);
  });

  it("returns an empty array for no members", () => {
    expect(detectDormantMembers([], NOW)).toEqual([]);
  });

  it("returns an empty array when everyone is recently active", () => {
    const members = [
      { userId: 7, lastActiveMs: NOW - 1 * DAY },
      { userId: 8, lastActiveMs: NOW - 2 * DAY },
    ];
    expect(detectDormantMembers(members, NOW)).toEqual([]);
  });

  it("includes a member idle exactly at the threshold (inclusive boundary)", () => {
    const members = [{ userId: 5, lastActiveMs: NOW - 1000 }];
    expect(
      detectDormantMembers(members, NOW, { dormantAfterMs: 1000 }),
    ).toEqual([{ userId: 5, idleMs: 1000 }]);
  });

  it("excludes a member just below the threshold", () => {
    const members = [{ userId: 6, lastActiveMs: NOW - 999 }];
    expect(
      detectDormantMembers(members, NOW, { dormantAfterMs: 1000 }),
    ).toEqual([]);
  });

  it("honors a custom dormantAfterMs window", () => {
    const members = [
      { userId: 1, lastActiveMs: NOW - 3 * DAY },
      { userId: 2, lastActiveMs: NOW - 10 * DAY },
    ];
    expect(
      detectDormantMembers(members, NOW, { dormantAfterMs: 5 * DAY }),
    ).toEqual([{ userId: 2, idleMs: 10 * DAY }]);
  });

  it("never flags a member active in the future (negative idle)", () => {
    const members = [{ userId: 9, lastActiveMs: NOW + 5 * DAY }];
    expect(detectDormantMembers(members, NOW)).toEqual([]);
  });

  it("breaks idle ties by userId ascending", () => {
    const members = [
      { userId: 30, lastActiveMs: NOW - 20 * DAY },
      { userId: 10, lastActiveMs: NOW - 20 * DAY },
      { userId: 20, lastActiveMs: NOW - 20 * DAY },
    ];
    expect(detectDormantMembers(members, NOW).map((m) => m.userId)).toEqual([
      10, 20, 30,
    ]);
  });

  it("produces the same ordering regardless of input order (determinism)", () => {
    const a = [
      { userId: 1, lastActiveMs: NOW - 30 * DAY },
      { userId: 2, lastActiveMs: NOW - 15 * DAY },
      { userId: 3, lastActiveMs: NOW - 40 * DAY },
    ];
    const b = [a[2], a[0], a[1]].filter(
      (m): m is (typeof a)[number] => m !== undefined,
    );
    expect(detectDormantMembers(a, NOW)).toEqual(detectDormantMembers(b, NOW));
  });

  it("does not mutate the input array", () => {
    const members = [
      { userId: 1, lastActiveMs: NOW - 30 * DAY },
      { userId: 2, lastActiveMs: NOW - 40 * DAY },
    ];
    const snapshot = [...members];
    detectDormantMembers(members, NOW);
    expect(members).toEqual(snapshot);
  });
});
