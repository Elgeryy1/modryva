import { describe, expect, it } from "vitest";
import {
  GRATITUDE_PER_THANKS,
  type GratitudeEntry,
  grantGratitude,
  rankGratitude,
} from "./gratitude.js";

const entry = (userId: string, points: number): GratitudeEntry => ({
  userId,
  points,
});

describe("GRATITUDE_PER_THANKS", () => {
  it("is a positive whole number", () => {
    expect(GRATITUDE_PER_THANKS).toBe(5);
    expect(Number.isInteger(GRATITUDE_PER_THANKS)).toBe(true);
    expect(GRATITUDE_PER_THANKS).toBeGreaterThan(0);
  });
});

describe("grantGratitude", () => {
  it("adds a thanks worth of points to a starting balance", () => {
    expect(grantGratitude(0, GRATITUDE_PER_THANKS)).toBe(5);
    expect(grantGratitude(10, GRATITUDE_PER_THANKS)).toBe(15);
  });

  it("sums arbitrary positive amounts", () => {
    expect(grantGratitude(3, 4)).toBe(7);
    expect(grantGratitude(100, 250)).toBe(350);
  });

  it("returns the current balance when amount is zero", () => {
    expect(grantGratitude(42, 0)).toBe(42);
  });

  it("allows negative amounts to reduce the balance", () => {
    expect(grantGratitude(10, -3)).toBe(7);
  });

  it("never returns a negative balance", () => {
    expect(grantGratitude(2, -5)).toBe(0);
    expect(grantGratitude(0, -1)).toBe(0);
    expect(grantGratitude(-10, 3)).toBe(0);
  });

  it("treats NaN inputs as zero", () => {
    expect(grantGratitude(Number.NaN, 5)).toBe(5);
    expect(grantGratitude(5, Number.NaN)).toBe(5);
    expect(grantGratitude(Number.NaN, Number.NaN)).toBe(0);
  });

  it("treats non-finite inputs as zero", () => {
    expect(grantGratitude(Number.POSITIVE_INFINITY, 5)).toBe(5);
    expect(grantGratitude(5, Number.NEGATIVE_INFINITY)).toBe(5);
  });

  it("is deterministic for identical inputs", () => {
    expect(grantGratitude(7, 8)).toBe(grantGratitude(7, 8));
  });
});

describe("rankGratitude", () => {
  it("orders entries from most to least points", () => {
    const ranked = rankGratitude([
      entry("a", 10),
      entry("b", 30),
      entry("c", 20),
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["b", "c", "a"]);
  });

  it("keeps tie order stable by input position", () => {
    const ranked = rankGratitude([
      entry("first", 5),
      entry("second", 5),
      entry("third", 5),
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["first", "second", "third"]);
  });

  it("mixes ties and distinct values with stable ordering", () => {
    const ranked = rankGratitude([
      entry("a", 10),
      entry("b", 20),
      entry("c", 10),
      entry("d", 20),
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["b", "d", "a", "c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(rankGratitude([])).toEqual([]);
  });

  it("handles a single entry", () => {
    expect(rankGratitude([entry("solo", 3)])).toEqual([entry("solo", 3)]);
  });

  it("does not mutate the input array", () => {
    const input = [entry("a", 1), entry("b", 2)];
    const snapshot = input.map((r) => r.userId);
    rankGratitude(input);
    expect(input.map((r) => r.userId)).toEqual(snapshot);
  });

  it("returns a new array instance", () => {
    const input = [entry("a", 1)];
    expect(rankGratitude(input)).not.toBe(input);
  });

  it("orders zero-point entries after positive ones, stably", () => {
    const ranked = rankGratitude([entry("a", 0), entry("b", 1), entry("c", 0)]);
    expect(ranked.map((r) => r.userId)).toEqual(["b", "a", "c"]);
  });

  it("is deterministic for identical inputs", () => {
    const input = [entry("a", 2), entry("b", 2), entry("c", 5)];
    expect(rankGratitude(input)).toEqual(rankGratitude(input));
  });
});
