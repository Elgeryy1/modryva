import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLOT_PAYTABLE,
  decodeSlot,
  isJackpot,
  isSlotValue,
  slotMultiplier,
} from "./slot.js";

describe("telegram slot decode", () => {
  it("validates the 1..64 value range", () => {
    expect(isSlotValue(1)).toBe(true);
    expect(isSlotValue(64)).toBe(true);
    expect(isSlotValue(0)).toBe(false);
    expect(isSlotValue(65)).toBe(false);
    expect(isSlotValue(1.5)).toBe(false);
  });

  it("decodes the four known triples", () => {
    expect(decodeSlot(1).symbol).toBe("bar");
    expect(decodeSlot(1).kind).toBe("triple");
    expect(decodeSlot(22).symbol).toBe("grape");
    expect(decodeSlot(43).symbol).toBe("lemon");
    expect(decodeSlot(64).symbol).toBe("seven");
    expect(decodeSlot(64).kind).toBe("triple");
    expect(isJackpot(decodeSlot(64))).toBe(true);
    expect(isJackpot(decodeSlot(1))).toBe(false);
  });

  it("every value 1..64 decodes to three valid reels", () => {
    for (let value = 1; value <= 64; value += 1) {
      const spin = decodeSlot(value);
      expect(spin.reels).toHaveLength(3);
      for (const reel of spin.reels) {
        expect(["bar", "grape", "lemon", "seven"]).toContain(reel);
      }
    }
  });

  it("prices triples, pairs and losses", () => {
    expect(slotMultiplier(decodeSlot(64))).toBe(
      DEFAULT_SLOT_PAYTABLE.triple.seven,
    );
    // A guaranteed non-matching spin pays 0. Value 2 => v=1 => reels (grape,bar,bar).
    const loss = decodeSlot(2);
    expect(loss.kind).not.toBe("triple");
    // Find a value that is a loss (no left pair, no triple) to assert 0 payout.
    let sawLoss = false;
    for (let value = 1; value <= 64; value += 1) {
      if (decodeSlot(value).kind === "none") {
        expect(slotMultiplier(decodeSlot(value))).toBe(0);
        sawLoss = true;
        break;
      }
    }
    expect(sawLoss).toBe(true);
  });
});
