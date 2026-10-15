import { describe, expect, it } from "vitest";
import { checkRuleCooldown, DEFAULT_COOLDOWN_MS } from "./rule-cooldown.js";

describe("checkRuleCooldown", () => {
  it("allows when the rule never fired", () => {
    expect(checkRuleCooldown(undefined, 1000)).toEqual({
      allowed: true,
      remainingMs: 0,
    });
  });

  it("blocks at the exact moment it fired using the default cooldown", () => {
    expect(checkRuleCooldown(1000, 1000)).toEqual({
      allowed: false,
      remainingMs: 60000,
    });
  });

  it("allows exactly when the default cooldown has elapsed (boundary)", () => {
    expect(checkRuleCooldown(1000, 1000 + DEFAULT_COOLDOWN_MS)).toEqual({
      allowed: true,
      remainingMs: 0,
    });
  });

  it("blocks one millisecond before the cooldown elapses", () => {
    expect(checkRuleCooldown(1000, 60999)).toEqual({
      allowed: false,
      remainingMs: 1,
    });
  });

  it("uses a custom cooldown while still within the window", () => {
    expect(checkRuleCooldown(1000, 4000, { cooldownMs: 5000 })).toEqual({
      allowed: false,
      remainingMs: 2000,
    });
  });

  it("allows once the custom cooldown window is reached", () => {
    expect(checkRuleCooldown(1000, 6000, { cooldownMs: 5000 })).toEqual({
      allowed: true,
      remainingMs: 0,
    });
  });

  it("handles clock skew where nowMs precedes lastFiredMs", () => {
    expect(checkRuleCooldown(5000, 1000, { cooldownMs: 2000 })).toEqual({
      allowed: false,
      remainingMs: 6000,
    });
  });

  it("treats a zero cooldown as always allowed", () => {
    expect(checkRuleCooldown(1000, 1000, { cooldownMs: 0 })).toEqual({
      allowed: true,
      remainingMs: 0,
    });
  });

  it("treats a negative cooldown as zero", () => {
    expect(checkRuleCooldown(1000, 1000, { cooldownMs: -5000 })).toEqual({
      allowed: true,
      remainingMs: 0,
    });
  });

  it("is deterministic for identical inputs", () => {
    const a = checkRuleCooldown(2000, 30000, { cooldownMs: 45000 });
    const b = checkRuleCooldown(2000, 30000, { cooldownMs: 45000 });
    expect(a).toEqual(b);
    expect(a).toEqual({ allowed: false, remainingMs: 17000 });
  });
});
