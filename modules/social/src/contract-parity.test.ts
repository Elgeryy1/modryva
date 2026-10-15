import {
  POLE_CLAIM_MODE_VALUES,
  ROULETTE_CONSEQUENCE_VALUES,
  SOCIAL_KEY,
  SOCIAL_MAX_MUTE_SECONDS,
  SOCIAL_MIN_MUTE_SECONDS,
  socialSettingsSchema,
  THREAD_SCOPE_VALUES,
} from "@superbot/shared";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOCIAL_SETTINGS,
  MAX_MUTE_SECONDS,
  MIN_MUTE_SECONDS,
  normalizeSocialSettings,
  POLE_CLAIM_MODES,
  ROULETTE_CONSEQUENCES,
  SOCIAL_SETTINGS_KEY,
  THREAD_SCOPES,
} from "./settings.js";

/**
 * The social settings live in TWO places on purpose: packages/shared ships to
 * the browser bundle and modules/social must not, so the Mini App validates
 * against its own copy of the shape.
 *
 * Deliberate duplication needs a test, or it stops being deliberate and starts
 * being drift. This repo has been bitten by exactly that before (the start-param
 * codec), so the constants and the shape are pinned here rather than trusted.
 */

describe("shared contract ↔ social module", () => {
  it("agrees on the ChatSetting key", () => {
    // Disagree here and the Mini App writes settings the bot never reads —
    // silently, with no error anywhere.
    expect(SOCIAL_KEY).toBe(SOCIAL_SETTINGS_KEY);
  });

  it("agrees on every enumeration", () => {
    expect([...POLE_CLAIM_MODE_VALUES]).toEqual([...POLE_CLAIM_MODES]);
    expect([...THREAD_SCOPE_VALUES]).toEqual([...THREAD_SCOPES]);
    expect([...ROULETTE_CONSEQUENCE_VALUES]).toEqual([
      ...ROULETTE_CONSEQUENCES,
    ]);
  });

  it("agrees on the mute bounds that keep Telegram honest", () => {
    expect(SOCIAL_MIN_MUTE_SECONDS).toBe(MIN_MUTE_SECONDS);
    expect(SOCIAL_MAX_MUTE_SECONDS).toBe(MAX_MUTE_SECONDS);
  });

  it("accepts the module's own defaults", () => {
    // The strongest parity check available: what the bot would write must be
    // something the Mini App would accept.
    expect(
      socialSettingsSchema.safeParse(DEFAULT_SOCIAL_SETTINGS).success,
    ).toBe(true);
  });

  it("round-trips anything the schema accepts through the normaliser", () => {
    const candidate = {
      pole: {
        enabled: true,
        mode: "AUTO_FIRST_MESSAGE" as const,
        timezone: "America/Bogota",
        resetMinutes: 390,
        positions: 5,
        threadScope: "per-topic" as const,
        allowMedia: true,
        summaryEnabled: true,
      },
      roulette: {
        enabled: true,
        consequence: "TEMPORARY_MUTE" as const,
        numerator: 3,
        denominator: 10,
        muteSeconds: 900,
        userCooldownSeconds: 45,
        chatCooldownSeconds: 10,
      },
      fun: { pauloEnabled: true, catsEnabled: true, dogsEnabled: false },
      supportUrl: "https://modryva.example/apoyo",
    };
    expect(socialSettingsSchema.safeParse(candidate).success).toBe(true);
    // The bot must read back exactly what the Mini App saved — no field
    // quietly reset to a default on the way in.
    expect(normalizeSocialSettings(candidate)).toEqual(candidate);
  });

  it("both refuse a probability where every round loses", () => {
    const bad = {
      ...DEFAULT_SOCIAL_SETTINGS,
      roulette: {
        ...DEFAULT_SOCIAL_SETTINGS.roulette,
        numerator: 6,
        denominator: 6,
      },
    };
    expect(socialSettingsSchema.safeParse(bad).success).toBe(false);
    expect(normalizeSocialSettings(bad).roulette.numerator).toBe(1);
  });

  it("both refuse a mute short enough to become permanent", () => {
    const bad = {
      ...DEFAULT_SOCIAL_SETTINGS,
      roulette: { ...DEFAULT_SOCIAL_SETTINGS.roulette, muteSeconds: 5 },
    };
    expect(socialSettingsSchema.safeParse(bad).success).toBe(false);
    expect(normalizeSocialSettings(bad).roulette.muteSeconds).toBe(
      MIN_MUTE_SECONDS,
    );
  });

  it("both refuse a support link that is not https", () => {
    for (const supportUrl of ["javascript:alert(1)", "http://x.com"]) {
      const bad = { ...DEFAULT_SOCIAL_SETTINGS, supportUrl };
      expect(socialSettingsSchema.safeParse(bad).success).toBe(false);
      expect(normalizeSocialSettings(bad).supportUrl).toBe("");
    }
  });
});
