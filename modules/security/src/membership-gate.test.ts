import { describe, expect, it } from "vitest";
import { isActiveChatMember } from "./membership-gate.js";

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
