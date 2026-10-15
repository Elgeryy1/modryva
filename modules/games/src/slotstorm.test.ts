import { describe, expect, it } from "vitest";
import { describeSlot, resolveSlot } from "./slotstorm.js";

describe("resolveSlot", () => {
  it("value 64 is the jackpot with the top multiplier (triple sevens)", () => {
    const { multiplier, detail } = resolveSlot(64);
    expect(detail.jackpot).toBe(true);
    expect(detail.reels).toEqual(["seven", "seven", "seven"]);
    expect(multiplier).toBe(20);
    expect(detail.multiplier).toBe(20);
    expect(describeSlot(detail)).toBe("7️⃣ 7️⃣ 7️⃣ — ¡JACKPOT! x20");
  });

  it("value 1 is a triple bar (not a jackpot)", () => {
    const { multiplier, detail } = resolveSlot(1);
    expect(detail.reels).toEqual(["bar", "bar", "bar"]);
    expect(detail.jackpot).toBe(false);
    expect(multiplier).toBe(12);
    expect(describeSlot(detail)).toBe("🍫 🍫 🍫 — ¡Triple! x12");
  });

  it("a losing value pays 0 (value 2 = grape·bar·bar, no match)", () => {
    const { multiplier, detail } = resolveSlot(2);
    expect(detail.reels).toEqual(["grape", "bar", "bar"]);
    expect(detail.jackpot).toBe(false);
    expect(multiplier).toBe(0);
    expect(describeSlot(detail)).toBe("🍇 🍫 🍫 — Sin premio x0");
  });

  it("a leftmost pair returns the consolation multiplier", () => {
    // value 3 -> v=2: left=2(lemon), middle=0(bar), right=0(bar) -> no left pair.
    // value 6 -> v=5: left=1(grape), middle=1(grape), right=0(bar) -> left pair.
    const { multiplier, detail } = resolveSlot(6);
    expect(detail.reels).toEqual(["grape", "grape", "bar"]);
    expect(detail.jackpot).toBe(false);
    expect(multiplier).toBe(1.5);
    expect(describeSlot(detail)).toBe("🍇 🍇 🍫 — ¡Par! x1.5");
  });

  it("is deterministic: same value yields identical results", () => {
    const a = resolveSlot(43);
    const b = resolveSlot(43);
    expect(a).toEqual(b);
    expect(a.detail.reels).toEqual(["lemon", "lemon", "lemon"]);
    expect(a.multiplier).toBe(8);
    expect(describeSlot(a.detail)).toBe(describeSlot(b.detail));
  });
});
