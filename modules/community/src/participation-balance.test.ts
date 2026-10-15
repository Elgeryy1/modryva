import { describe, expect, it } from "vitest";
import {
  detectMonopoly,
  participationGini,
  type SpeakerStat,
} from "./participation-balance.js";

const stat = (userId: string, messages: number): SpeakerStat => ({
  userId,
  messages,
});

describe("detectMonopoly", () => {
  it("flags a user that meets the dominance ratio exactly", () => {
    const result = detectMonopoly(
      [stat("a", 6), stat("b", 2), stat("c", 2)],
      0.6,
    );
    expect(result.monopolized).toBe(true);
    expect(result.userId).toBe("a");
    expect(result.share).toBeCloseTo(0.6, 10);
  });

  it("flags a user above the dominance ratio", () => {
    const result = detectMonopoly([stat("a", 9), stat("b", 1)], 0.7);
    expect(result).toEqual({ monopolized: true, userId: "a", share: 0.9 });
  });

  it("does not flag when the top share is below the ratio", () => {
    const result = detectMonopoly(
      [stat("a", 4), stat("b", 3), stat("c", 3)],
      0.6,
    );
    expect(result.monopolized).toBe(false);
    expect(result.userId).toBeUndefined();
    expect(result.share).toBeCloseTo(0.4, 10);
  });

  it("omits userId entirely when not monopolized (exactOptional-safe)", () => {
    const result = detectMonopoly([stat("a", 1), stat("b", 1)], 0.9);
    expect("userId" in result).toBe(false);
  });

  it("returns a safe zero result for an empty list", () => {
    expect(detectMonopoly([], 0.5)).toEqual({ monopolized: false, share: 0 });
  });

  it("returns a safe zero result when every count is zero", () => {
    expect(detectMonopoly([stat("a", 0), stat("b", 0)], 0.5)).toEqual({
      monopolized: false,
      share: 0,
    });
  });

  it("ignores negative and non-finite counts", () => {
    const result = detectMonopoly(
      [stat("a", 8), stat("b", -5), stat("c", Number.NaN)],
      0.9,
    );
    expect(result).toEqual({ monopolized: true, userId: "a", share: 1 });
  });

  it("breaks ties by first appearance order", () => {
    const result = detectMonopoly([stat("a", 5), stat("b", 5)], 0.5);
    expect(result.userId).toBe("a");
    expect(result.share).toBeCloseTo(0.5, 10);
  });

  it("treats a single active speaker as full monopoly", () => {
    expect(detectMonopoly([stat("solo", 10)], 0.5)).toEqual({
      monopolized: true,
      userId: "solo",
      share: 1,
    });
  });

  it("never flags with a ratio above one", () => {
    const result = detectMonopoly([stat("a", 100), stat("b", 1)], 1.5);
    expect(result.monopolized).toBe(false);
    expect(result.userId).toBeUndefined();
  });

  it("is deterministic for identical inputs", () => {
    const input = [stat("a", 7), stat("b", 2), stat("c", 1)];
    expect(detectMonopoly(input, 0.6)).toEqual(detectMonopoly(input, 0.6));
  });
});

describe("participationGini", () => {
  it("returns 0 for perfectly equal participation", () => {
    expect(participationGini([stat("a", 5), stat("b", 5), stat("c", 5)])).toBe(
      0,
    );
  });

  it("returns 0 for an empty list", () => {
    expect(participationGini([])).toBe(0);
  });

  it("returns 0 for a single speaker", () => {
    expect(participationGini([stat("a", 42)])).toBe(0);
  });

  it("returns 0 when the total is zero", () => {
    expect(participationGini([stat("a", 0), stat("b", 0)])).toBe(0);
  });

  it("gives a higher score for more unequal distributions", () => {
    const balanced = participationGini([
      stat("a", 4),
      stat("b", 5),
      stat("c", 6),
    ]);
    const skewed = participationGini([
      stat("a", 1),
      stat("b", 1),
      stat("c", 20),
    ]);
    expect(skewed).toBeGreaterThan(balanced);
  });

  it("computes a known two-speaker Gini", () => {
    // counts [1, 3]: sum|diff| = 2*2 = 4; 2*n*total = 2*2*4 = 16; gini = 0.25
    expect(participationGini([stat("a", 1), stat("b", 3)])).toBeCloseTo(
      0.25,
      10,
    );
  });

  it("stays within [0, 1] for an extreme skew", () => {
    const gini = participationGini([
      stat("a", 1),
      stat("b", 1),
      stat("c", 1),
      stat("d", 1_000_000),
    ]);
    expect(gini).toBeGreaterThan(0);
    expect(gini).toBeLessThanOrEqual(1);
  });

  it("ignores negative and non-finite counts", () => {
    const withNoise = participationGini([
      stat("a", 1),
      stat("b", 3),
      stat("c", -10),
      stat("d", Number.POSITIVE_INFINITY),
    ]);
    expect(withNoise).toBeCloseTo(0.25, 10);
  });

  it("is order-independent", () => {
    const forward = participationGini([
      stat("a", 2),
      stat("b", 5),
      stat("c", 9),
    ]);
    const reversed = participationGini([
      stat("c", 9),
      stat("b", 5),
      stat("a", 2),
    ]);
    expect(forward).toBeCloseTo(reversed, 12);
  });

  it("is deterministic for identical inputs", () => {
    const input = [stat("a", 3), stat("b", 6), stat("c", 11)];
    expect(participationGini(input)).toBe(participationGini(input));
  });
});
