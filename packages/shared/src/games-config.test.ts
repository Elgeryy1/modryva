import { describe, expect, it } from "vitest";
import {
  defaultGamesConfig,
  gamesConfigSchema,
  parseGamesConfig,
  purposeAnnounces,
  recommendedPurpose,
} from "./games-config.js";

describe("purposeAnnounces", () => {
  it("only announces for game-bearing purposes", () => {
    expect(purposeAnnounces("moderate")).toBe(false);
    expect(purposeAnnounces("play")).toBe(true);
    expect(purposeAnnounces("both")).toBe(true);
  });
});

describe("recommendedPurpose", () => {
  it("leans support/business bots to moderation", () => {
    expect(recommendedPurpose("support")).toBe("moderate");
    expect(recommendedPurpose("business")).toBe("moderate");
  });

  it("leans creator bots to games", () => {
    expect(recommendedPurpose("creator")).toBe("play");
  });

  it("defaults community/custom/primary to both", () => {
    expect(recommendedPurpose("community")).toBe("both");
    expect(recommendedPurpose("custom")).toBe("both");
    expect(recommendedPurpose(null)).toBe("both");
    expect(recommendedPurpose(undefined)).toBe("both");
  });
});

describe("defaultGamesConfig", () => {
  it("starts unconfigured with every game on", () => {
    const cfg = defaultGamesConfig();
    expect(cfg.configured).toBe(false);
    expect(cfg.purpose).toBe("both");
    expect(cfg.triviaCadence).toBe("daily");
    expect(Object.values(cfg.games).every(Boolean)).toBe(true);
  });

  it("derives announce from the given purpose", () => {
    expect(defaultGamesConfig("moderate").announce).toBe(false);
    expect(defaultGamesConfig("play").announce).toBe(true);
  });
});

describe("parseGamesConfig", () => {
  it("returns defaults for missing / non-object input", () => {
    expect(parseGamesConfig(undefined)).toEqual(defaultGamesConfig());
    expect(parseGamesConfig(null)).toEqual(defaultGamesConfig());
    expect(parseGamesConfig("nope")).toEqual(defaultGamesConfig());
  });

  it("round-trips a full valid config", () => {
    const full = {
      purpose: "play" as const,
      games: {
        tictactoe: false,
        rps: true,
        quiz: true,
        dailytrivia: true,
        boss: false,
      },
      triviaCadence: "hourly" as const,
      announce: true,
      configured: true,
    };
    expect(parseGamesConfig(full)).toEqual(full);
  });

  it("fills missing game toggles with the on default", () => {
    const cfg = parseGamesConfig({ purpose: "both", games: { boss: false } });
    expect(cfg.games.boss).toBe(false);
    expect(cfg.games.tictactoe).toBe(true);
    expect(cfg.games.quiz).toBe(true);
  });

  it("coerces an unknown cadence to daily", () => {
    expect(parseGamesConfig({ triviaCadence: "weekly" }).triviaCadence).toBe(
      "daily",
    );
  });

  it("derives announce from purpose when absent", () => {
    expect(parseGamesConfig({ purpose: "moderate" }).announce).toBe(false);
    expect(parseGamesConfig({ purpose: "play" }).announce).toBe(true);
  });
});

describe("gamesConfigSchema", () => {
  it("rejects a config missing required fields", () => {
    expect(gamesConfigSchema.safeParse({ purpose: "play" }).success).toBe(
      false,
    );
  });

  it("accepts a full config", () => {
    expect(gamesConfigSchema.safeParse(defaultGamesConfig()).success).toBe(
      true,
    );
  });
});
