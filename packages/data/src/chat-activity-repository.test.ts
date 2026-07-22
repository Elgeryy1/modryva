import { describe, expect, it } from "vitest";
import { InMemoryChatActivityRepository } from "./chat-activity-repository.js";

describe("InMemoryChatActivityRepository.findOriginalMessage", () => {
  it("finds the original message by telegram message id", async () => {
    const repo = new InMemoryChatActivityRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      kind: "message",
      telegramUserId: 9n,
      text: "hola",
      messageId: 50n,
    });

    const original = await repo.findOriginalMessage("t1", "c1", 50n);
    expect(original?.text).toBe("hola");
    expect(original?.messageId).toBe(50n);
  });

  it("returns undefined when no message carries that id", async () => {
    const repo = new InMemoryChatActivityRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      kind: "message",
      telegramUserId: 9n,
      text: "hola",
      messageId: 50n,
    });

    expect(await repo.findOriginalMessage("t1", "c1", 999n)).toBeUndefined();
  });
});

describe("InMemoryChatActivityRepository.findUserEvent", () => {
  it("finds a user's own daily marker by kind + user + messageId (day key)", async () => {
    const repo = new InMemoryChatActivityRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      kind: "daily_trivia",
      telegramUserId: 7n,
      messageId: 20_100n, // day key
      text: "1", // answered correctly
    });

    const mine = await repo.findUserEvent(
      "t1",
      "c1",
      "daily_trivia",
      7n,
      20_100n,
    );
    expect(mine?.text).toBe("1");
    // A different user, or a different day, has no marker yet.
    expect(
      await repo.findUserEvent("t1", "c1", "daily_trivia", 8n, 20_100n),
    ).toBeUndefined();
    expect(
      await repo.findUserEvent("t1", "c1", "daily_trivia", 7n, 20_101n),
    ).toBeUndefined();
  });
});
