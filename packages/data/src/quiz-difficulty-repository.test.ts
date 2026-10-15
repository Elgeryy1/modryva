import { describe, expect, it } from "vitest";
import { InMemoryQuizDifficultyRepository } from "./quiz-difficulty-repository.js";

describe("InMemoryQuizDifficultyRepository", () => {
  it("defaults to level 1 for a user who never played", async () => {
    const repo = new InMemoryQuizDifficultyRepository();
    expect(await repo.getLevel("t1", "c1", 111n)).toBe(1);
  });

  it("stores and returns an updated level", async () => {
    const repo = new InMemoryQuizDifficultyRepository();
    await repo.setLevel("t1", "c1", 111n, 3);
    expect(await repo.getLevel("t1", "c1", 111n)).toBe(3);
  });

  it("overwrites the level on repeated updates", async () => {
    const repo = new InMemoryQuizDifficultyRepository();
    await repo.setLevel("t1", "c1", 111n, 3);
    await repo.setLevel("t1", "c1", 111n, 2);
    expect(await repo.getLevel("t1", "c1", 111n)).toBe(2);
  });

  it("keeps levels for different chats of the same user distinct", async () => {
    const repo = new InMemoryQuizDifficultyRepository();
    await repo.setLevel("t1", "c1", 111n, 4);
    await repo.setLevel("t1", "c2", 111n, 2);
    expect(await repo.getLevel("t1", "c1", 111n)).toBe(4);
    expect(await repo.getLevel("t1", "c2", 111n)).toBe(2);
  });

  it("keeps levels for different users of the same chat distinct", async () => {
    const repo = new InMemoryQuizDifficultyRepository();
    await repo.setLevel("t1", "c1", 111n, 5);
    await repo.setLevel("t1", "c1", 222n, 1);
    expect(await repo.getLevel("t1", "c1", 111n)).toBe(5);
    expect(await repo.getLevel("t1", "c1", 222n)).toBe(1);
  });
});
