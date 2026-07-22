import { describe, expect, it } from "vitest";
import { gradeExam } from "./exam-grade.js";

describe("gradeExam", () => {
  it("grades all-correct as 100 percent and passed", () => {
    expect(
      gradeExam([
        { given: "a", correct: "a" },
        { given: "b", correct: "b" },
      ]),
    ).toEqual({ score: 2, total: 2, percent: 100, passed: true });
  });

  it("compares case- and whitespace-insensitively", () => {
    expect(gradeExam([{ given: " Roma ", correct: "roma" }]).score).toBe(1);
  });

  it("rounds the percent to an integer", () => {
    expect(
      gradeExam([
        { given: "a", correct: "a" },
        { given: "x", correct: "b" },
        { given: "c", correct: "c" },
      ]).percent,
    ).toBe(67);
  });

  it("fails below 50 percent", () => {
    expect(
      gradeExam([
        { given: "a", correct: "a" },
        { given: "x", correct: "b" },
        { given: "y", correct: "c" },
      ]).passed,
    ).toBe(false);
  });

  it("passes at exactly 50 percent", () => {
    expect(
      gradeExam([
        { given: "a", correct: "a" },
        { given: "x", correct: "b" },
      ]).passed,
    ).toBe(true);
  });

  it("handles an empty exam", () => {
    expect(gradeExam([])).toEqual({
      score: 0,
      total: 0,
      percent: 0,
      passed: false,
    });
  });
});
