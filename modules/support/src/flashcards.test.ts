import { describe, expect, it } from "vitest";
import {
  dueFlashcards,
  FLASHCARD_MAX_EASE_MS,
  FLASHCARD_MIN_EASE_MS,
  type Flashcard,
  type FlashcardGrade,
  reviewFlashcard,
} from "./flashcards.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const card = (overrides: Partial<Flashcard> = {}): Flashcard => ({
  id: "c1",
  easeMillis: HOUR,
  dueMs: 0,
  ...overrides,
});

describe("reviewFlashcard", () => {
  it("preserves the id and does not mutate the input", () => {
    const original = card({ id: "keep-me", easeMillis: HOUR, dueMs: 123 });
    const result = reviewFlashcard(original, 2, 10_000);
    expect(result.id).toBe("keep-me");
    expect(original).toEqual({ id: "keep-me", easeMillis: HOUR, dueMs: 123 });
    expect(result).not.toBe(original);
  });

  it("resets to the minimum interval on a failing grade (0)", () => {
    const result = reviewFlashcard(card({ easeMillis: 30 * DAY }), 0, 5_000);
    expect(result.easeMillis).toBe(FLASHCARD_MIN_EASE_MS);
    expect(result.dueMs).toBe(5_000 + FLASHCARD_MIN_EASE_MS);
  });

  it("grows the interval slightly on a hard grade (1)", () => {
    const result = reviewFlashcard(card({ easeMillis: HOUR }), 1, 0);
    expect(result.easeMillis).toBe(Math.round(HOUR * 1.2));
  });

  it("multiplies the interval on a good grade (2)", () => {
    const result = reviewFlashcard(card({ easeMillis: HOUR }), 2, 0);
    expect(result.easeMillis).toBe(Math.round(HOUR * 2.5));
  });

  it("multiplies the interval most on an easy grade (3)", () => {
    const result = reviewFlashcard(card({ easeMillis: HOUR }), 3, 0);
    expect(result.easeMillis).toBe(Math.round(HOUR * 3.5));
  });

  it("orders the resulting interval by grade (higher grade, longer interval)", () => {
    const base = card({ easeMillis: HOUR });
    const grades: readonly FlashcardGrade[] = [0, 1, 2, 3];
    const eases = grades.map((g) => reviewFlashcard(base, g, 0).easeMillis);
    for (let i = 1; i < eases.length; i += 1) {
      const prev = eases[i - 1] ?? 0;
      const curr = eases[i] ?? 0;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it("sets dueMs to nowMs plus the new interval", () => {
    const result = reviewFlashcard(card({ easeMillis: HOUR }), 2, 1_000_000);
    expect(result.dueMs).toBe(1_000_000 + Math.round(HOUR * 2.5));
  });

  it("caps the interval at the maximum on repeated easy grades", () => {
    let current = card({ easeMillis: 100 * DAY });
    for (let i = 0; i < 20; i += 1) {
      current = reviewFlashcard(current, 3, 0);
    }
    expect(current.easeMillis).toBe(FLASHCARD_MAX_EASE_MS);
  });

  it("never drops below the minimum interval on a hard grade", () => {
    const result = reviewFlashcard(card({ easeMillis: 1_000 }), 1, 0);
    expect(result.easeMillis).toBe(FLASHCARD_MIN_EASE_MS);
  });

  it("treats a non-positive stored interval as the minimum base", () => {
    const zero = reviewFlashcard(card({ easeMillis: 0 }), 2, 0);
    expect(zero.easeMillis).toBe(Math.round(FLASHCARD_MIN_EASE_MS * 2.5));
    const negative = reviewFlashcard(card({ easeMillis: -HOUR }), 2, 0);
    expect(negative.easeMillis).toBe(Math.round(FLASHCARD_MIN_EASE_MS * 2.5));
  });

  it("is deterministic for identical inputs", () => {
    const input = card({ id: "det", easeMillis: 3 * HOUR, dueMs: 42 });
    expect(reviewFlashcard(input, 2, 999)).toEqual(
      reviewFlashcard(input, 2, 999),
    );
  });

  it("keeps the interval within bounds for every grade", () => {
    const grades: readonly FlashcardGrade[] = [0, 1, 2, 3];
    for (const g of grades) {
      const result = reviewFlashcard(card({ easeMillis: 200 * DAY }), g, 0);
      expect(result.easeMillis).toBeGreaterThanOrEqual(FLASHCARD_MIN_EASE_MS);
      expect(result.easeMillis).toBeLessThanOrEqual(FLASHCARD_MAX_EASE_MS);
    }
  });
});

describe("dueFlashcards", () => {
  it("returns cards whose dueMs is at or before nowMs", () => {
    const cards = [
      card({ id: "a", dueMs: 100 }),
      card({ id: "b", dueMs: 200 }),
      card({ id: "c", dueMs: 300 }),
    ];
    expect(dueFlashcards(cards, 200).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("treats dueMs exactly equal to nowMs as due", () => {
    const cards = [card({ id: "a", dueMs: 500 })];
    expect(dueFlashcards(cards, 500).map((c) => c.id)).toEqual(["a"]);
  });

  it("preserves the input order", () => {
    const cards = [
      card({ id: "z", dueMs: 0 }),
      card({ id: "y", dueMs: 0 }),
      card({ id: "x", dueMs: 0 }),
    ];
    expect(dueFlashcards(cards, 10).map((c) => c.id)).toEqual(["z", "y", "x"]);
  });

  it("returns an empty array when none are due", () => {
    const cards = [card({ dueMs: 1_000 }), card({ dueMs: 2_000 })];
    expect(dueFlashcards(cards, 500)).toEqual([]);
  });

  it("returns an empty array for no cards", () => {
    expect(dueFlashcards([], 1_000)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const cards = [card({ id: "a", dueMs: 0 }), card({ id: "b", dueMs: 999 })];
    const snapshot = cards.slice();
    dueFlashcards(cards, 10);
    expect(cards).toEqual(snapshot);
  });
});
