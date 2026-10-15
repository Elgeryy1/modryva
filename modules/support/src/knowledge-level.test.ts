import { describe, expect, it } from "vitest";
import { classifyKnowledgeLevel } from "./knowledge-level.js";

describe("classifyKnowledgeLevel", () => {
  it("classifies a high scorer as avanzado", () => {
    expect(
      classifyKnowledgeLevel({ correctAnswers: 9, totalAnswers: 10 }),
    ).toEqual({ level: "avanzado", ratio: 0.9 });
  });

  it("classifies a mid scorer as intermedio", () => {
    expect(
      classifyKnowledgeLevel({ correctAnswers: 6, totalAnswers: 10 }),
    ).toEqual({ level: "intermedio", ratio: 0.6 });
  });

  it("classifies a low scorer as principiante", () => {
    expect(
      classifyKnowledgeLevel({ correctAnswers: 2, totalAnswers: 10 }),
    ).toEqual({ level: "principiante", ratio: 0.2 });
  });

  it("treats the avanzado boundary inclusively", () => {
    expect(
      classifyKnowledgeLevel({ correctAnswers: 8, totalAnswers: 10 }).level,
    ).toBe("avanzado");
  });

  it("guards zero answers", () => {
    expect(
      classifyKnowledgeLevel({ correctAnswers: 0, totalAnswers: 0 }),
    ).toEqual({ level: "principiante", ratio: 0 });
  });
});
