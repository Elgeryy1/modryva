import { describe, expect, it } from "vitest";
import {
  type ConflictPair,
  shouldBlockMention,
  startConflictCooldown,
} from "./conflict-cooldown.js";

const pair = (overrides: Partial<ConflictPair> = {}): ConflictPair => ({
  aId: "111",
  bId: "222",
  ...overrides,
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("startConflictCooldown", () => {
  it("adds a positive duration to now", () => {
    expect(startConflictCooldown(1_000, HOUR)).toBe(1_000 + HOUR);
  });

  it("returns now for a zero duration", () => {
    expect(startConflictCooldown(5_000, 0)).toBe(5_000);
  });

  it("clamps negative durations to zero", () => {
    expect(startConflictCooldown(5_000, -HOUR)).toBe(5_000);
  });

  it("is deterministic for identical inputs", () => {
    expect(startConflictCooldown(42, 10 * MINUTE)).toBe(
      startConflictCooldown(42, 10 * MINUTE),
    );
  });

  it("works with a zero base timestamp", () => {
    expect(startConflictCooldown(0, MINUTE)).toBe(MINUTE);
  });
});

describe("shouldBlockMention", () => {
  const until = startConflictCooldown(0, HOUR); // 3_600_000

  it("blocks a forward mention while the cooldown is active", () => {
    expect(shouldBlockMention(pair(), until, 0, "111", "222")).toBe(true);
  });

  it("blocks a backward mention (order independent)", () => {
    expect(shouldBlockMention(pair(), until, 0, "222", "111")).toBe(true);
  });

  it("does not block once the cooldown has expired", () => {
    expect(shouldBlockMention(pair(), until, until, "111", "222")).toBe(false);
    expect(shouldBlockMention(pair(), until, until + 1, "111", "222")).toBe(
      false,
    );
  });

  it("blocks right up to but not including the boundary", () => {
    expect(shouldBlockMention(pair(), until, until - 1, "111", "222")).toBe(
      true,
    );
  });

  it("never blocks a self-mention", () => {
    expect(shouldBlockMention(pair(), until, 0, "111", "111")).toBe(false);
  });

  it("does not block when the sender is a third party", () => {
    expect(shouldBlockMention(pair(), until, 0, "333", "222")).toBe(false);
  });

  it("does not block when the target is a third party", () => {
    expect(shouldBlockMention(pair(), until, 0, "111", "333")).toBe(false);
  });

  it("does not block a mention between two unrelated third parties", () => {
    expect(shouldBlockMention(pair(), until, 0, "333", "444")).toBe(false);
  });

  it("does not block when neither user is in the pair", () => {
    expect(shouldBlockMention(pair(), until, 0, "999", "888")).toBe(false);
  });

  it("treats ids as exact strings, not numbers", () => {
    expect(shouldBlockMention(pair(), until, 0, "111", " 222")).toBe(false);
    expect(
      shouldBlockMention(pair({ bId: "0222" }), until, 0, "111", "222"),
    ).toBe(false);
  });

  it("handles a pair where both ids are equal (degenerate)", () => {
    const same = pair({ aId: "500", bId: "500" });
    // from !== to can never match a pair whose members are identical.
    expect(shouldBlockMention(same, until, 0, "500", "600")).toBe(false);
    expect(shouldBlockMention(same, until, 0, "600", "500")).toBe(false);
  });

  it("does not block when cooldown is already zero at now zero", () => {
    expect(shouldBlockMention(pair(), 0, 0, "111", "222")).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const a = shouldBlockMention(pair(), until, 10, "111", "222");
    const b = shouldBlockMention(pair(), until, 10, "111", "222");
    expect(a).toBe(b);
  });
});
