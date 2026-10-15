import { InMemoryGuardianRepository } from "@superbot/data";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GuardianDevController } from "./guardian-dev.controller.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.GUARDIAN_TEST_MODE = "1";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

const buildController = (): {
  controller: GuardianDevController;
  repo: InMemoryGuardianRepository;
} => {
  const repo = new InMemoryGuardianRepository();
  const controller = new GuardianDevController();
  // biome-ignore lint/suspicious/noExplicitAny: overriding a private field for testing has no public API
  (controller as any).guardian = repo;
  return { controller, repo };
};

describe("GuardianDevController", () => {
  it("mints a real, usable session token when test mode is on", async () => {
    const { controller } = buildController();
    const result = await controller.createTestSession({
      chatId: "chat-1",
      telegramChatId: "-100999",
      telegramUserId: "42",
    });
    expect(result.sessionToken).toBeTruthy();
    expect(result.telegramUserId).toBe("42");
  });

  it("self-provisions Guardian settings for a chat that didn't exist yet", async () => {
    const { controller, repo } = buildController();
    await controller.createTestSession({
      chatId: "brand-new-chat",
      telegramChatId: "-100999",
      telegramUserId: "42",
      mode: "strict",
    });
    const settings = await repo.getSettings("any-tenant", "brand-new-chat");
    expect(settings?.enabled).toBe(true);
    expect(settings?.mode).toBe("strict");
  });

  it("404s when GUARDIAN_TEST_MODE is off, even with a valid body", async () => {
    process.env.GUARDIAN_TEST_MODE = "0";
    const { controller } = buildController();
    await expect(
      controller.createTestSession({
        chatId: "chat-1",
        telegramChatId: "-100999",
        telegramUserId: "42",
      }),
    ).rejects.toThrow();
  });

  it("404s in production even with GUARDIAN_TEST_MODE=1", async () => {
    process.env.NODE_ENV = "production";
    const { controller } = buildController();
    await expect(
      controller.createTestSession({
        chatId: "chat-1",
        telegramChatId: "-100999",
        telegramUserId: "42",
      }),
    ).rejects.toThrow();
  });

  it("rejects a body missing required fields", async () => {
    const { controller } = buildController();
    await expect(controller.createTestSession({})).rejects.toThrow();
  });

  it("rejects creating a second session while one is already active for the same user+chat", async () => {
    const { controller } = buildController();
    const body = {
      chatId: "chat-1",
      telegramChatId: "-100999",
      telegramUserId: "42",
    };
    await controller.createTestSession(body);
    await expect(controller.createTestSession(body)).rejects.toThrow();
  });
});
