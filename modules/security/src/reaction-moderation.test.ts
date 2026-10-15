import type { NormalizedReaction } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  classifyReactionModeration,
  DEFAULT_REACTION_MODERATION,
  evaluateReactionAbuse,
  isReactionSurge,
  parseReactionModerationConfig,
  type ReactionModerationConfig,
  resolveEnforceOutcome,
} from "./reaction-moderation.js";

const cfg = (
  overrides: Partial<ReactionModerationConfig>,
): ReactionModerationConfig => ({
  ...DEFAULT_REACTION_MODERATION,
  ...overrides,
});

const emoji = (value: string): NormalizedReaction => ({
  type: "emoji",
  emoji: value,
});
const custom = (id: string): NormalizedReaction => ({
  type: "custom_emoji",
  customEmojiId: id,
});

describe("parseReactionModerationConfig", () => {
  it("falls back to defaults for null/garbage input", () => {
    expect(parseReactionModerationConfig(null)).toEqual(
      DEFAULT_REACTION_MODERATION,
    );
    expect(parseReactionModerationConfig("nope")).toEqual(
      DEFAULT_REACTION_MODERATION,
    );
  });

  it("keeps a valid mode and rejects an unknown one", () => {
    expect(parseReactionModerationConfig({ mode: "enforce" }).mode).toBe(
      "enforce",
    );
    expect(parseReactionModerationConfig({ mode: "turbo" }).mode).toBe("off");
  });

  it("normalizes both blocklists: trims, dedupes, drops non-strings, caps at 50", () => {
    const parsed = parseReactionModerationConfig({
      blockedEmojis: [" 🖕 ", "🖕", "", 7, "💩"],
      blockedCustomEmojiIds: ["a", "a", " b "],
    });
    expect(parsed.blockedEmojis).toEqual(["🖕", "💩"]);
    expect(parsed.blockedCustomEmojiIds).toEqual(["a", "b"]);

    const many = Array.from({ length: 80 }, (_, i) => `e${i}`);
    expect(
      parseReactionModerationConfig({ blockedEmojis: many }).blockedEmojis,
    ).toHaveLength(50);
  });

  it("clamps surge thresholds into their safe ranges", () => {
    const low = parseReactionModerationConfig({
      surgeThreshold: 1,
      surgeWindowSeconds: 1,
    });
    expect(low.surgeThreshold).toBe(2);
    expect(low.surgeWindowSeconds).toBe(5);

    const high = parseReactionModerationConfig({
      surgeThreshold: 999999,
      surgeWindowSeconds: 999999,
    });
    expect(high.surgeThreshold).toBe(1000);
    expect(high.surgeWindowSeconds).toBe(3600);
  });
});

describe("evaluateReactionAbuse", () => {
  it("returns nothing when off, even with a blocklist", () => {
    expect(
      evaluateReactionAbuse(
        [emoji("🖕")],
        cfg({ mode: "off", blockedEmojis: ["🖕"] }),
      ),
    ).toEqual([]);
  });

  it("returns nothing when both blocklists are empty", () => {
    expect(
      evaluateReactionAbuse([emoji("🖕")], cfg({ mode: "enforce" })),
    ).toEqual([]);
  });

  it("matches blocked standard emojis", () => {
    const blocked = evaluateReactionAbuse(
      [emoji("👍"), emoji("🖕"), emoji("💩")],
      cfg({ mode: "enforce", blockedEmojis: ["🖕", "💩"] }),
    );
    expect(blocked).toEqual([emoji("🖕"), emoji("💩")]);
  });

  it("matches blocked custom emojis by id", () => {
    const blocked = evaluateReactionAbuse(
      [custom("safe"), custom("nasty")],
      cfg({ mode: "shadow", blockedCustomEmojiIds: ["nasty"] }),
    );
    expect(blocked).toEqual([custom("nasty")]);
  });
});

describe("classifyReactionModeration (phase 1: no permission consulted)", () => {
  const blockedCfg = (mode: ReactionModerationConfig["mode"]) =>
    cfg({ mode, blockedEmojis: ["🖕"] });

  it("is none when off, so we never call getMe/getChatMember", () => {
    expect(
      classifyReactionModeration([emoji("🖕")], blockedCfg("off")).kind,
    ).toBe("none");
  });

  it("is none when nothing added is blocked", () => {
    expect(
      classifyReactionModeration([emoji("👍")], blockedCfg("enforce")).kind,
    ).toBe("none");
  });

  it("observes (audit-only, no Telegram touch) in shadow mode", () => {
    const c = classifyReactionModeration([emoji("🖕")], blockedCfg("shadow"));
    expect(c.kind).toBe("observe");
    expect(c.kind === "observe" ? c.blocked : []).toEqual([emoji("🖕")]);
  });

  it("flags enforce (the only branch that must resolve permission)", () => {
    const c = classifyReactionModeration(
      [emoji("👍"), emoji("🖕")],
      blockedCfg("enforce"),
    );
    expect(c.kind).toBe("enforce");
    expect(c.kind === "enforce" ? c.blocked : []).toEqual([emoji("🖕")]);
  });
});

describe("resolveEnforceOutcome (phase 2: tri-state permission)", () => {
  const blocked = [emoji("🖕")];

  it("removes when the bot can delete (true)", () => {
    expect(resolveEnforceOutcome(blocked, true).kind).toBe("remove");
  });

  it("reports missing_permission when confirmed absent (false)", () => {
    expect(resolveEnforceOutcome(blocked, false).kind).toBe(
      "missing_permission",
    );
  });

  it("degrades to permission_unknown on a transient/unknown result (undefined) — never alerts 'missing'", () => {
    expect(resolveEnforceOutcome(blocked, undefined).kind).toBe(
      "permission_unknown",
    );
  });
});

describe("isReactionSurge", () => {
  const config = cfg({ mode: "enforce", surgeThreshold: 3 });

  it("is false when off regardless of volume", () => {
    expect(isReactionSurge(100, cfg({ mode: "off" }))).toBe(false);
  });

  it("is false below the distinct-suspicious-actor threshold", () => {
    expect(isReactionSurge(2, config)).toBe(false);
  });

  it("fires at the threshold", () => {
    expect(isReactionSurge(3, config)).toBe(true);
  });
});
