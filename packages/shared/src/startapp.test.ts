import { describe, expect, it } from "vitest";
import {
  buildMiniAppLink,
  decodeStartParam,
  encodeAppointedAdminsStartParam,
  encodeConfigStartParam,
  encodeGameStartParam,
  encodeGamesHubStartParam,
  encodeInlineGameStartParam,
  encodeOnboardingStartParam,
  encodeRosterStartParam,
  ROSTER_ALL_START_PARAM,
  START_PARAM_RE,
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

describe("roster start param (/bdani)", () => {
  it("round-trips a group id", () => {
    const encoded = encodeRosterStartParam("-1009000000001");
    expect(decodeStartParam(encoded)).toEqual({
      kind: "roster",
      groupId: "-1009000000001",
    });
  });

  it("stays inside Telegram's startapp character limit", () => {
    expect(START_PARAM_RE.test(encodeRosterStartParam("-1009000000001"))).toBe(
      true,
    );
  });

  it("does not collide with the config payload", () => {
    expect(decodeStartParam("cfg_-100123")?.kind).toBe("config");
    expect(decodeStartParam("bd_-100123")?.kind).toBe("roster");
  });

  it("rejects an empty group id", () => {
    expect(decodeStartParam("bd_")).toBeNull();
  });

  it("reads the cross-group payload as no group, not a group called 'all'", () => {
    // The whole point: `bd_all` must NOT fall through to the generic `bd_`
    // branch, which would hand the api a chat id of "all" and 404 forever.
    expect(decodeStartParam(ROSTER_ALL_START_PARAM)).toEqual({
      kind: "roster",
      groupId: null,
    });
  });

  it("keeps real group ids working alongside the cross-group payload", () => {
    expect(decodeStartParam("bd_-1009000000001")).toEqual({
      kind: "roster",
      groupId: "-1009000000001",
    });
  });

  it("stays inside Telegram's startapp character limit (cross-group)", () => {
    expect(START_PARAM_RE.test(ROSTER_ALL_START_PARAM)).toBe(true);
  });
});

describe("appointed-admins start param (/adminlist)", () => {
  it("round-trips a group id", () => {
    const encoded = encodeAppointedAdminsStartParam("-1009000000001");
    expect(encoded).toBe("adm_-1009000000001");
    expect(decodeStartParam(encoded)).toEqual({
      kind: "appointedAdmins",
      groupId: "-1009000000001",
    });
  });

  it("does not collide with any other payload prefix", () => {
    expect(decodeStartParam("adm_-100123")?.kind).toBe("appointedAdmins");
    expect(decodeStartParam("bd_-100123")?.kind).toBe("roster");
    expect(decodeStartParam("cfg_-100123")?.kind).toBe("config");
  });

  it("rejects an empty group id", () => {
    expect(decodeStartParam("adm_")).toBeNull();
  });

  it("stays inside Telegram's startapp character limit", () => {
    expect(
      START_PARAM_RE.test(encodeAppointedAdminsStartParam("-1009000000001")),
    ).toBe(true);
  });
});
