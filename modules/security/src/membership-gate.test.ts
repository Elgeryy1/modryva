import { describe, expect, it } from "vitest";
import { isActiveChatMember, isJoinTransition } from "./membership-gate.js";

describe("isActiveChatMember", () => {
  it.each([
    "creator",
    "administrator",
    "member",
    "restricted",
  ] as const)("treats %s as still a member", (status) => {
    expect(isActiveChatMember(status)).toBe(true);
  });

  it.each([
    "left",
    "kicked",
    undefined,
  ] as const)("treats %s as not a member", (status) => {
    expect(isActiveChatMember(status)).toBe(false);
  });
});

describe("isJoinTransition", () => {
  it.each([
    ["left", "member"],
    ["kicked", "member"],
    [undefined, "member"],
    // An approved join request can land the newcomer straight into a
    // restricted state (welcome-mute, or a group that mutes by default).
    ["left", "restricted"],
    // Being added by an admin who promotes at the same time.
    ["left", "administrator"],
  ] as const)("treats %s -> %s as a join", (oldStatus, newStatus) => {
    expect(isJoinTransition(oldStatus, newStatus)).toBe(true);
  });

  it.each([
    // Promotions and demotions: the person was already inside.
    ["member", "administrator"],
    ["administrator", "member"],
    // Muting and unmuting someone who never left.
    ["member", "restricted"],
    ["restricted", "member"],
  ] as const)("does not treat %s -> %s as a join", (oldStatus, newStatus) => {
    expect(isJoinTransition(oldStatus, newStatus)).toBe(false);
  });

  it.each([
    ["member", "left"],
    ["member", "kicked"],
    ["administrator", "kicked"],
  ] as const)("does not treat %s -> %s as a join", (oldStatus, newStatus) => {
    expect(isJoinTransition(oldStatus, newStatus)).toBe(false);
  });

  it("does not treat an unchanged non-membership as a join", () => {
    expect(isJoinTransition("kicked", "left")).toBe(false);
    expect(isJoinTransition(undefined, undefined)).toBe(false);
  });
});
