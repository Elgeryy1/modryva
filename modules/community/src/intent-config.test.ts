import { describe, expect, it } from "vitest";
import {
  COMMUNITY_INTENTS,
  type CommunityIntent,
  mapIntentToConfig,
} from "./intent-config.js";

const SETTING_KEYS = [
  "antiSpamFilter",
  "linkGuard",
  "captchaOnJoin",
  "slowMode",
  "reportQueue",
  "friendlyWelcome",
  "growthReferrals",
];

describe("mapIntentToConfig", () => {
  it("configures anti_spam with strict guards and no growth", () => {
    expect(mapIntentToConfig("anti_spam")).toEqual({
      intent: "anti_spam",
      settings: {
        antiSpamFilter: true,
        linkGuard: true,
        captchaOnJoin: true,
        slowMode: true,
        reportQueue: false,
        friendlyWelcome: false,
        growthReferrals: false,
      },
      summary:
        "🛡️ Modo antispam: filtros estrictos, captcha al entrar y modo lento activados para frenar el spam.",
    });
  });

  it("configures ordenar with the report queue enabled", () => {
    const config = mapIntentToConfig("ordenar");
    expect(config.settings.reportQueue).toBe(true);
    expect(config.settings.slowMode).toBe(false);
    expect(config.settings.friendlyWelcome).toBe(false);
  });

  it("configures chill with every guard relaxed and a friendly welcome", () => {
    const config = mapIntentToConfig("chill");
    expect(config.settings.antiSpamFilter).toBe(false);
    expect(config.settings.captchaOnJoin).toBe(false);
    expect(config.settings.slowMode).toBe(false);
    expect(config.settings.friendlyWelcome).toBe(true);
    expect(config.settings.growthReferrals).toBe(false);
  });

  it("configures crecer with referrals on and basic antispam", () => {
    const config = mapIntentToConfig("crecer");
    expect(config.settings.growthReferrals).toBe(true);
    expect(config.settings.friendlyWelcome).toBe(true);
    expect(config.settings.antiSpamFilter).toBe(true);
  });

  it("echoes the requested intent back in the config", () => {
    for (const intent of COMMUNITY_INTENTS) {
      expect(mapIntentToConfig(intent).intent).toBe(intent);
    }
  });

  it("returns the same setting keys for every intent", () => {
    for (const intent of COMMUNITY_INTENTS) {
      const keys = Object.keys(mapIntentToConfig(intent).settings).sort();
      expect(keys).toEqual([...SETTING_KEYS].sort());
    }
  });

  it("produces a non-empty Spanish summary for every intent", () => {
    for (const intent of COMMUNITY_INTENTS) {
      expect(mapIntentToConfig(intent).summary.length).toBeGreaterThan(0);
    }
  });

  it("keeps anti_spam and chill configurations distinct", () => {
    expect(mapIntentToConfig("anti_spam")).not.toEqual(
      mapIntentToConfig("chill"),
    );
  });

  it("exposes intents in canonical declared order", () => {
    expect(COMMUNITY_INTENTS).toEqual([
      "anti_spam",
      "ordenar",
      "chill",
      "crecer",
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const intents: readonly CommunityIntent[] = [
      "anti_spam",
      "ordenar",
      "chill",
      "crecer",
    ];
    for (const intent of intents) {
      expect(mapIntentToConfig(intent)).toEqual(mapIntentToConfig(intent));
    }
  });
});
