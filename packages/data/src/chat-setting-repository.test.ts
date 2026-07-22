import { describe, expect, it } from "vitest";
import { InMemoryChatSettingRepository } from "./chat-setting-repository.js";

describe("InMemoryChatSettingRepository", () => {
  it("stores and reads a value per (tenant, chat, key)", async () => {
    const repo = new InMemoryChatSettingRepository();
    await repo.setValue("t1", "c1", "games_config", { purpose: "play" });
    expect(await repo.getValue("t1", "c1", "games_config")).toEqual({
      purpose: "play",
    });
    expect(await repo.getValue("t1", "c1", "missing")).toBeUndefined();
    expect(await repo.getValue("t1", "c2", "games_config")).toBeUndefined();
  });

  it("lists every chat that has a value under a key", async () => {
    const repo = new InMemoryChatSettingRepository();
    await repo.setValue("t1", "c1", "games_config", 1);
    await repo.setValue("t1", "c2", "games_config", 2);
    await repo.setValue("t1", "c1", "coop_boss", 9);
    const entries = await repo.listByKey("games_config");
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.chatId).sort()).toEqual(["c1", "c2"]);
    expect(entries.every((e) => e.tenantId === "t1")).toBe(true);
    expect(await repo.listByKey("nope")).toHaveLength(0);
  });

  it("keeps chat ids that contain colons distinct", async () => {
    const repo = new InMemoryChatSettingRepository();
    await repo.setValue("t1", "dm:t1:42", "k", "a");
    await repo.setValue("t1", "dm:t1:43", "k", "b");
    expect(await repo.getValue("t1", "dm:t1:42", "k")).toBe("a");
    expect(await repo.getValue("t1", "dm:t1:43", "k")).toBe("b");
    expect(await repo.listByKey("k")).toHaveLength(2);
  });
});
