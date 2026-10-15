import { describe, expect, it } from "vitest";
import { spendEnergy } from "./energy-system.js";

describe("spendEnergy", () => {
  it("allows a spend the user can afford and subtracts the cost", () => {
    expect(spendEnergy({ current: 100, cost: 20, max: 100 })).toEqual({
      allowed: true,
      remaining: 80,
    });
  });

  it("rejects a spend the user cannot afford and keeps the balance", () => {
    expect(spendEnergy({ current: 10, cost: 20, max: 100 })).toEqual({
      allowed: false,
      remaining: 10,
    });
  });

  it("rejects a negative cost as abuse without changing the balance", () => {
    expect(spendEnergy({ current: 10, cost: -5, max: 100 })).toEqual({
      allowed: false,
      remaining: 10,
    });
  });

  it("allows a zero-cost action and leaves the balance intact", () => {
    expect(spendEnergy({ current: 50, cost: 0, max: 100 })).toEqual({
      allowed: true,
      remaining: 50,
    });
  });

  it("allows spending exactly the whole balance down to zero", () => {
    expect(spendEnergy({ current: 20, cost: 20, max: 100 })).toEqual({
      allowed: true,
      remaining: 0,
    });
  });

  it("clamps an over-cap remaining balance down to max", () => {
    expect(spendEnergy({ current: 150, cost: 20, max: 100 })).toEqual({
      allowed: true,
      remaining: 100,
    });
  });

  it("clamps a negative starting balance up to zero when rejected", () => {
    expect(spendEnergy({ current: -5, cost: 3, max: 100 })).toEqual({
      allowed: false,
      remaining: 0,
    });
  });

  it("treats a negative max as a zero ceiling", () => {
    expect(spendEnergy({ current: 10, cost: 4, max: -1 })).toEqual({
      allowed: true,
      remaining: 0,
    });
  });

  it("handles a zero starting balance with a zero cost", () => {
    expect(spendEnergy({ current: 0, cost: 0, max: 5 })).toEqual({
      allowed: true,
      remaining: 0,
    });
  });

  it("is deterministic across repeated identical calls", () => {
    const input = { current: 42, cost: 7, max: 60 } as const;
    const first = spendEnergy(input);
    const second = spendEnergy(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ allowed: true, remaining: 35 });
  });
});
