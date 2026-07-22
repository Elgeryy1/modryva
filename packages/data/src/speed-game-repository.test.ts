import { describe, expect, it } from "vitest";
import { InMemorySpeedGameRepository } from "./speed-game-repository.js";

const START = new Date("2026-01-01T00:00:00.000Z");
const CLOSES = new Date("2026-01-01T00:00:20.000Z");

describe("InMemorySpeedGameRepository", () => {
  it("creates an open round and returns it via getOpenRound", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound(
      "t1",
      "c1",
      "2+2?",
      "4",
      START,
      CLOSES,
    );

    expect(round.status).toBe("open");
    expect(round.question).toBe("2+2?");
    expect(round.answer).toBe("4");

    const open = await repo.getOpenRound("t1", "c1");
    expect(open?.id).toBe(round.id);
  });

  it("scopes open rounds per (tenant, chat)", async () => {
    const repo = new InMemorySpeedGameRepository();
    await repo.createRound("t1", "c1", "q1", "a1", START, CLOSES);

    expect(await repo.getOpenRound("t1", "c2")).toBeNull();
    expect(await repo.getOpenRound("t2", "c1")).toBeNull();
  });

  it("records a first answer per user and rejects duplicates", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound("t1", "c1", "q", "a", START, CLOSES);

    const first = await repo.submitAnswer(
      round.id,
      1n,
      new Date(START.getTime() + 100),
      true,
    );
    const duplicate = await repo.submitAnswer(
      round.id,
      1n,
      new Date(START.getTime() + 5_000),
      true,
    );

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
  });

  it("throws when submitting to a round that does not exist", async () => {
    const repo = new InMemorySpeedGameRepository();
    await expect(
      repo.submitAnswer("missing", 1n, START, true),
    ).rejects.toThrow();
  });

  it("closes a round and ranks the fastest correct answer as winner", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound("t1", "c1", "q", "42", START, CLOSES);

    await repo.submitAnswer(
      round.id,
      1n,
      new Date(START.getTime() + 3_000),
      false,
    );
    await repo.submitAnswer(
      round.id,
      2n,
      new Date(START.getTime() + 2_000),
      true,
    );
    await repo.submitAnswer(
      round.id,
      3n,
      new Date(START.getTime() + 1_000),
      true,
    );

    const result = await repo.closeRound(round.id);

    expect(result.winnerUserId).toBe("3");
    expect(result.ranked).toEqual([
      { userId: "3", ms: 1_000 },
      { userId: "2", ms: 2_000 },
    ]);

    const closed = await repo.getRound(round.id);
    expect(closed?.status).toBe("closed");
    expect(closed?.winnerUserId).toBe(3n);
  });

  it("returns a null winner when nobody answered correctly", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound("t1", "c1", "q", "a", START, CLOSES);
    await repo.submitAnswer(
      round.id,
      1n,
      new Date(START.getTime() + 500),
      false,
    );

    const result = await repo.closeRound(round.id);
    expect(result.winnerUserId).toBeNull();
    expect(result.ranked).toEqual([]);
  });

  it("no longer reports the round as open once closed", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound("t1", "c1", "q", "a", START, CLOSES);
    await repo.closeRound(round.id);

    expect(await repo.getOpenRound("t1", "c1")).toBeNull();
  });

  it("is idempotent: closing an already-closed round returns the same ranking", async () => {
    const repo = new InMemorySpeedGameRepository();
    const round = await repo.createRound("t1", "c1", "q", "a", START, CLOSES);
    await repo.submitAnswer(
      round.id,
      1n,
      new Date(START.getTime() + 1_000),
      true,
    );

    const first = await repo.closeRound(round.id);
    const second = await repo.closeRound(round.id);

    expect(second).toEqual(first);
  });

  it("throws when closing a round that does not exist", async () => {
    const repo = new InMemorySpeedGameRepository();
    await expect(repo.closeRound("missing")).rejects.toThrow();
  });
});
