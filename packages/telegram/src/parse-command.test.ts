import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "./parse-command.js";

describe("parseTelegramCommand", () => {
  it("parses a simple command", () => {
    expect(parseTelegramCommand("/start")).toEqual({
      name: "start",
      botUsername: undefined,
      args: [],
      raw: "/start",
    });
  });

  it("keeps arguments", () => {
    expect(parseTelegramCommand("/ban @user 7d spam")).toMatchObject({
      name: "ban",
      args: ["@user", "7d", "spam"],
    });
  });

  it("filters commands for a different bot username", () => {
    expect(parseTelegramCommand("/start@anotherbot", "mybot")).toBeNull();
  });
});
