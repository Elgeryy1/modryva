import { describe, expect, it } from "vitest";
import {
  buildMiniAppLink,
  decodeStartParam,
  encodeConfigStartParam,
  encodeGameStartParam,
  encodeGamesHubStartParam,
  encodeInlineGameStartParam,
  encodeOnboardingStartParam,
} from "./startapp.js";

const NEG = "-1001234567890"; // a real supergroup id (negative)

describe("startapp codec", () => {
  it("round-trips a config param with a negative group id", () => {
    const param = encodeConfigStartParam(NEG);
    expect(param).toBe(`cfg_${NEG}`);
    expect(decodeStartParam(param)).toEqual({ kind: "config", groupId: NEG });
  });

  it("round-trips a game param with a negative group id", () => {
    const param = encodeGameStartParam("reflex", NEG);
    expect(param).toBe(`game_reflex_${NEG}`);
    expect(decodeStartParam(param)).toEqual({
      kind: "game",
      game: "reflex",
      groupId: NEG,
    });
  });

  it("round-trips an onboarding param with a negative group id", () => {
    const param = encodeOnboardingStartParam(NEG);
    expect(param).toBe(`onb_${NEG}`);
    expect(decodeStartParam(param)).toEqual({
      kind: "onboarding",
      groupId: NEG,
    });
    expect(decodeStartParam("onb_")).toBeNull(); // empty group id
  });

  it("round-trips portable inline game params", () => {
    const param = encodeInlineGameStartParam("math-sprint");
    expect(param).toBe("inline_math-sprint");
    expect(decodeStartParam(param)).toEqual({
      kind: "inlineGame",
      game: "math-sprint",
    });
    expect(decodeStartParam("games")).toEqual({ kind: "gamesHub" });
  });

  it("round-trips the games hub, portable and group-scoped", () => {
    expect(encodeGamesHubStartParam()).toBe("games");
    expect(decodeStartParam("games")).toEqual({ kind: "gamesHub" });

    const param = encodeGamesHubStartParam(NEG);
    expect(param).toBe(`games_${NEG}`);
    expect(decodeStartParam(param)).toEqual({ kind: "gamesHub", groupId: NEG });

    // `games_` must not be mistaken for the `game_` (single game) prefix.
    expect(decodeStartParam(param)).not.toMatchObject({ kind: "game" });
    expect(decodeStartParam("games_")).toBeNull(); // empty group id
  });

  it("rejects malformed params", () => {
    expect(decodeStartParam(undefined)).toBeNull();
    expect(decodeStartParam("")).toBeNull();
    expect(decodeStartParam("cfg_ 123")).toBeNull(); // space -> regex fail
    expect(decodeStartParam(`cfg_${"9".repeat(70)}`)).toBeNull(); // >64
    expect(decodeStartParam("cfg_-100:1")).toBeNull(); // colon -> regex fail
    expect(decodeStartParam("game__5")).toBeNull(); // empty game name
    expect(decodeStartParam("game_reflex_")).toBeNull(); // empty group id
    expect(decodeStartParam("inline_")).toBeNull(); // empty game name
    expect(decodeStartParam("cfg_")).toBeNull(); // empty group id
  });

  it("throws on an invalid game name", () => {
    expect(() => encodeGameStartParam("bad name", NEG)).toThrow();
    expect(() => encodeGameStartParam("has_underscore", NEG)).toThrow();
  });

  it("builds a Mini App link", () => {
    expect(
      buildMiniAppLink("ModryvaBot", "config", encodeConfigStartParam(NEG)),
    ).toBe(`https://t.me/ModryvaBot/config?startapp=cfg_${NEG}`);
  });
});
