import { describe, expect, it } from "vitest";
import {
  canReappeal,
  REAPPEAL_DEFAULT_COOLDOWN_MS,
  reappealNextAllowedMs,
} from "./reappeal-cooldown.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe("REAPPEAL_DEFAULT_COOLDOWN_MS", () => {
  it("equals 24 hours in milliseconds", () => {
    expect(REAPPEAL_DEFAULT_COOLDOWN_MS).toBe(24 * HOUR);
  });
});

describe("canReappeal", () => {
  it("allows when the full cooldown has elapsed", () => {
    expect(canReappeal(0, HOUR, HOUR)).toEqual({ allowed: true, waitMs: 0 });
  });

  it("allows when more than the cooldown has elapsed", () => {
    expect(canReappeal(0, 3 * HOUR, HOUR)).toEqual({
      allowed: true,
      waitMs: 0,
    });
  });

  it("blocks and reports the remaining wait mid-cooldown", () => {
    expect(canReappeal(0, 20 * MINUTE, HOUR)).toEqual({
      allowed: false,
      waitMs: 40 * MINUTE,
    });
  });

  it("blocks with the full cooldown when no time has elapsed", () => {
    expect(canReappeal(1_000, 1_000, HOUR)).toEqual({
      allowed: false,
      waitMs: HOUR,
    });
  });

  it("allows exactly at the cooldown boundary", () => {
    expect(canReappeal(500, 500 + HOUR, HOUR)).toEqual({
      allowed: true,
      waitMs: 0,
    });
  });

  it("blocks one millisecond before the boundary", () => {
    expect(canReappeal(0, HOUR - 1, HOUR)).toEqual({
      allowed: false,
      waitMs: 1,
    });
  });

  it("treats a zero cooldown as always allowed", () => {
    expect(canReappeal(1_000, 1_000, 0)).toEqual({
      allowed: true,
      waitMs: 0,
    });
  });

  it("treats a negative cooldown as always allowed", () => {
    expect(canReappeal(0, 0, -HOUR)).toEqual({ allowed: true, waitMs: 0 });
  });

  it("treats a non-finite cooldown as always allowed", () => {
    expect(canReappeal(0, 0, Number.NaN)).toEqual({
      allowed: true,
      waitMs: 0,
    });
    expect(canReappeal(0, 0, Number.POSITIVE_INFINITY)).toEqual({
      allowed: true,
      waitMs: 0,
    });
  });

  it("caps the wait at the cooldown when lastAppeal is in the future", () => {
    // lastAppeal 2h ahead of now: elapsed is -2h, but wait must not exceed cooldown.
    expect(canReappeal(3 * HOUR, HOUR, HOUR)).toEqual({
      allowed: false,
      waitMs: HOUR,
    });
  });

  it("never returns a negative waitMs", () => {
    const decision = canReappeal(0, 10 * HOUR, HOUR);
    expect(decision.waitMs).toBeGreaterThanOrEqual(0);
  });

  it("truncates fractional remaining time to an integer", () => {
    expect(canReappeal(0, 0.5, HOUR)).toEqual({
      allowed: false,
      waitMs: HOUR - 1,
    });
  });

  it("works with the default cooldown constant", () => {
    expect(canReappeal(0, 12 * HOUR, REAPPEAL_DEFAULT_COOLDOWN_MS)).toEqual({
      allowed: false,
      waitMs: 12 * HOUR,
    });
  });

  it("is deterministic for identical inputs", () => {
    const a = canReappeal(5_000, 5_000 + 15 * MINUTE, HOUR);
    const b = canReappeal(5_000, 5_000 + 15 * MINUTE, HOUR);
    expect(a).toEqual(b);
  });

  it("handles large epoch-like timestamps", () => {
    const last = 1_700_000_000_000;
    const now = last + 30 * MINUTE;
    expect(canReappeal(last, now, HOUR)).toEqual({
      allowed: false,
      waitMs: 30 * MINUTE,
    });
  });
});

describe("reappealNextAllowedMs", () => {
  it("returns lastAppeal plus the cooldown", () => {
    expect(reappealNextAllowedMs(1_000, HOUR)).toBe(1_000 + HOUR);
  });

  it("returns lastAppeal when the cooldown is disabled", () => {
    expect(reappealNextAllowedMs(1_000, 0)).toBe(1_000);
    expect(reappealNextAllowedMs(1_000, -5)).toBe(1_000);
  });

  it("agrees with canReappeal at the computed boundary", () => {
    const last = 2_000;
    const next = reappealNextAllowedMs(last, HOUR);
    expect(canReappeal(last, next, HOUR).allowed).toBe(true);
    expect(canReappeal(last, next - 1, HOUR).allowed).toBe(false);
  });
});
