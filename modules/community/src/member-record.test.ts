import { describe, expect, it } from "vitest";
import { type MemberWarn, summarizeMemberRecord } from "./member-record.js";

describe("summarizeMemberRecord", () => {
  it("splits active and expired warns and sorts active by remainingMs asc", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "spam", expiresMs: 100 },
      { reason: "flood", expiresMs: 50 },
      { reason: "link", expiresMs: 30 },
    ];
    expect(summarizeMemberRecord(warns, 40)).toEqual({
      activeCount: 2,
      expiredCount: 1,
      active: [
        { reason: "flood", remainingMs: 10 },
        { reason: "spam", remainingMs: 60 },
      ],
    });
  });

  it("returns empty summary for no warns", () => {
    expect(summarizeMemberRecord([], 1000)).toEqual({
      activeCount: 0,
      expiredCount: 0,
      active: [],
    });
  });

  it("treats expiresMs equal to nowMs as expired (strict boundary)", () => {
    const warns: readonly MemberWarn[] = [{ reason: "spam", expiresMs: 500 }];
    expect(summarizeMemberRecord(warns, 500)).toEqual({
      activeCount: 0,
      expiredCount: 1,
      active: [],
    });
  });

  it("treats one millisecond past nowMs as active", () => {
    const warns: readonly MemberWarn[] = [{ reason: "spam", expiresMs: 501 }];
    expect(summarizeMemberRecord(warns, 500)).toEqual({
      activeCount: 1,
      expiredCount: 0,
      active: [{ reason: "spam", remainingMs: 1 }],
    });
  });

  it("counts every warn as expired when all are in the past", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "a", expiresMs: 10 },
      { reason: "b", expiresMs: 20 },
    ];
    expect(summarizeMemberRecord(warns, 100)).toEqual({
      activeCount: 0,
      expiredCount: 2,
      active: [],
    });
  });

  it("keeps original order for ties in remainingMs (stable sort)", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "first", expiresMs: 200 },
      { reason: "second", expiresMs: 200 },
      { reason: "third", expiresMs: 200 },
    ];
    const result = summarizeMemberRecord(warns, 100);
    expect(result.active).toEqual([
      { reason: "first", remainingMs: 100 },
      { reason: "second", remainingMs: 100 },
      { reason: "third", remainingMs: 100 },
    ]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "x", expiresMs: 90 },
      { reason: "y", expiresMs: 60 },
    ];
    const first = summarizeMemberRecord(warns, 50);
    const second = summarizeMemberRecord(warns, 50);
    expect(first).toEqual(second);
    expect(first.active).toEqual([
      { reason: "y", remainingMs: 10 },
      { reason: "x", remainingMs: 40 },
    ]);
  });

  it("does not mutate the input array", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "spam", expiresMs: 100 },
      { reason: "flood", expiresMs: 50 },
    ];
    const snapshot = [...warns];
    summarizeMemberRecord(warns, 40);
    expect(warns).toEqual(snapshot);
  });

  it("handles a single active warn", () => {
    const warns: readonly MemberWarn[] = [
      { reason: "toxico", expiresMs: 1000 },
    ];
    expect(summarizeMemberRecord(warns, 250)).toEqual({
      activeCount: 1,
      expiredCount: 0,
      active: [{ reason: "toxico", remainingMs: 750 }],
    });
  });
});
