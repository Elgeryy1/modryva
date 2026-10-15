import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOCIAL_SETTINGS,
  isSafeSupportUrl,
  isValidTimezone,
  MIN_MUTE_SECONDS,
  normalizeSocialSettings,
  scopeFor,
} from "./settings.js";

/**
 * The contract worth pinning: a settings row is untrusted. It can be older than
 * the code, hand-edited, or half-written, and none of those may take a group's
 * commands down.
 */

describe("normalizeSocialSettings", () => {
  it("returns the factory defaults for anything unusable", () => {
    for (const input of [undefined, null, 42, "social", [], {}]) {
      expect(normalizeSocialSettings(input)).toEqual(DEFAULT_SOCIAL_SETTINGS);
    }
  });

  it("ships with everything off, so deploying changes no group", () => {
    expect(DEFAULT_SOCIAL_SETTINGS.pole.enabled).toBe(false);
    expect(DEFAULT_SOCIAL_SETTINGS.roulette.enabled).toBe(false);
    expect(DEFAULT_SOCIAL_SETTINGS.fun.catsEnabled).toBe(false);
    expect(DEFAULT_SOCIAL_SETTINGS.fun.dogsEnabled).toBe(false);
    expect(DEFAULT_SOCIAL_SETTINGS.fun.pauloEnabled).toBe(false);
  });

  it("keeps the good fields of a partially written row", () => {
    const out = normalizeSocialSettings({
      pole: { enabled: true, positions: 1 },
      roulette: { enabled: true },
    });
    expect(out.pole.enabled).toBe(true);
    expect(out.pole.positions).toBe(1);
    // Untouched fields still carry their defaults rather than becoming undefined.
    expect(out.pole.mode).toBe("COMMAND_CLAIM");
    expect(out.roulette.denominator).toBe(6);
  });

  it("drops an out-of-range number instead of trusting it", () => {
    const out = normalizeSocialSettings({
      pole: { positions: 999, resetMinutes: 5000 },
      roulette: { muteSeconds: 5, userCooldownSeconds: -1 },
    });
    expect(out.pole.positions).toBe(3);
    expect(out.pole.resetMinutes).toBe(0);
    // 5 s would be read by Telegram as a PERMANENT restriction.
    expect(out.roulette.muteSeconds).toBe(MIN_MUTE_SECONDS);
    expect(out.roulette.userCooldownSeconds).toBe(30);
  });

  it("refuses a probability where every round loses", () => {
    // 6/6 is individually in range for both fields but means "always adverse".
    const out = normalizeSocialSettings({
      roulette: { numerator: 6, denominator: 6 },
    });
    expect(out.roulette.numerator).toBe(1);
    expect(out.roulette.denominator).toBe(6);
  });

  it("accepts a narrower probability that does make sense", () => {
    const out = normalizeSocialSettings({
      roulette: { numerator: 3, denominator: 10 },
    });
    expect(out.roulette.numerator).toBe(3);
    expect(out.roulette.denominator).toBe(10);
  });

  it("falls back when the timezone is not a real zone", () => {
    expect(
      normalizeSocialSettings({ pole: { timezone: "Mars/Olympus" } }).pole
        .timezone,
    ).toBe("Europe/Madrid");
    expect(
      normalizeSocialSettings({ pole: { timezone: "America/Bogota" } }).pole
        .timezone,
    ).toBe("America/Bogota");
  });

  it("drops a support URL that is not a plain https link", () => {
    const bad = [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:pass@example.com",
      "not a url",
    ];
    for (const value of bad) {
      expect(normalizeSocialSettings({ supportUrl: value }).supportUrl).toBe(
        "",
      );
    }
    expect(
      normalizeSocialSettings({ supportUrl: "https://example.com/apoyo" })
        .supportUrl,
    ).toBe("https://example.com/apoyo");
  });
});

describe("isValidTimezone / isSafeSupportUrl", () => {
  it("rejects the obvious attacks on a button people will tap", () => {
    expect(isSafeSupportUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeSupportUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeSupportUrl(`https://x.com/${"a".repeat(400)}`)).toBe(false);
  });

  it("knows a real zone from a plausible-looking string", () => {
    expect(isValidTimezone("Europe/Madrid")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/Madrid ")).toBe(false);
    expect(isValidTimezone(7)).toBe(false);
  });
});

describe("scopeFor", () => {
  const shared = DEFAULT_SOCIAL_SETTINGS.pole;
  const perTopic = { ...shared, threadScope: "per-topic" as const };

  it("ignores the topic when the group shares one competition", () => {
    expect(scopeFor("t1", -100n, 42, shared).threadId).toBeNull();
  });

  it("separates by topic only when the group asked for it", () => {
    expect(scopeFor("t1", -100n, 42, perTopic).threadId).toBe(42);
  });

  it("still yields a null thread in a group with no topics", () => {
    expect(scopeFor("t1", -100n, undefined, perTopic).threadId).toBeNull();
    expect(scopeFor("t1", -100n, null, perTopic).threadId).toBeNull();
  });
});
