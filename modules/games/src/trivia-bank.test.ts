import { describe, expect, it } from "vitest";
import { TRIVIA_BANK } from "./trivia-bank.js";

describe("trivia bank integrity", () => {
  it("has a large, unique bank with four valid options per question", () => {
    expect(TRIVIA_BANK.length).toBeGreaterThan(1000);

    const questions = new Set<string>();
    for (const question of TRIVIA_BANK) {
      expect(question.options).toHaveLength(4);
      expect(Number.isInteger(question.correctIndex)).toBe(true);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(4);
      expect(questions.has(question.question)).toBe(false);
      questions.add(question.question);
    }
  });
});
