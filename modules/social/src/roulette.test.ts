import { describe, expect, it } from "vitest";
import { sequenceRandom } from "./ports.js";
import {
  cooldownVerdict,
  decideRound,
  formatMuteDuration,
  resolveConsequence,
  safeMuteSeconds,
} from "./roulette.js";
import { MAX_MUTE_SECONDS, MIN_MUTE_SECONDS } from "./settings.js";

const at = (iso: string): Date => new Date(iso);

describe("decideRound", () => {
  it("is adverse exactly on the draws below the numerator", () => {
    // 1/6: only a 0 loses.
    const settings = { numerator: 1, denominator: 6 };
    const outcomes = [0, 1, 2, 3, 4, 5].map(
      (draw) => decideRound(settings, sequenceRandom([draw])).outcome,
    );
    expect(outcomes).toEqual([
      "adverse",
      "safe",
      "safe",
      "safe",
      "safe",
      "safe",
    ]);
  });

  it("scales with the numerator, so 3/10 really is three in ten", () => {
    const settings = { numerator: 3, denominator: 10 };
    const adverse = Array.from({ length: 10 }, (_, draw) => draw).filter(
      (draw) =>
        decideRound(settings, sequenceRandom([draw])).outcome === "adverse",
    );
    expect(adverse).toEqual([0, 1, 2]);
  });

  it("never lets a bad configuration make every round adverse", () => {
    // numerator >= denominator would mean a guaranteed hit; it gets clamped to
    // denominator - 1, so at least one draw always survives.
    const decision = decideRound(
      { numerator: 99, denominator: 6 },
      sequenceRandom([5]),
    );
    expect(decision.numerator).toBe(5);
    expect(decision.outcome).toBe("safe");
  });

  it("records the algorithm version, never the draw", () => {
    const decision = decideRound(
      { numerator: 1, denominator: 6 },
      sequenceRandom([0]),
    );
    expect(decision.rngVersion).toBe(1);
    // Publishing the draw would let anyone predict when the next round is safe.
    expect(Object.keys(decision)).not.toContain("draw");
    expect(Object.keys(decision)).not.toContain("seed");
  });
});

describe("safeMuteSeconds", () => {
  it("refuses the durations Telegram reads as PERMANENT", () => {
    // Under ~30 s, until_date is treated as forever. 5 s in a settings box must
    // never become a permanent silence.
    expect(safeMuteSeconds(5)).toBe(MIN_MUTE_SECONDS);
    expect(safeMuteSeconds(0)).toBe(MIN_MUTE_SECONDS);
    expect(safeMuteSeconds(-100)).toBe(MIN_MUTE_SECONDS);
    expect(safeMuteSeconds(Number.NaN)).toBe(MIN_MUTE_SECONDS);
  });

  it("caps the top end too", () => {
    expect(safeMuteSeconds(999_999_999)).toBe(MAX_MUTE_SECONDS);
  });

  it("passes a sensible value straight through", () => {
    expect(safeMuteSeconds(300)).toBe(300);
  });
});

describe("formatMuteDuration", () => {
  it("says it the way a person would", () => {
    expect(formatMuteDuration(60)).toBe("1 minuto");
    expect(formatMuteDuration(300)).toBe("5 minutos");
    expect(formatMuteDuration(3600)).toBe("1 hora");
    expect(formatMuteDuration(7200)).toBe("2 horas");
  });

  it("describes what will really happen, not what was asked for", () => {
    // Asked for 5 s, will get 60 s: the message must not promise 5 s.
    expect(formatMuteDuration(5)).toBe("1 minuto");
  });
});

describe("resolveConsequence", () => {
  const base = {
    muteSeconds: 300,
    botCanRestrict: true,
    targetIsProtected: false,
  };

  it("does nothing at all in FUN_ONLY", () => {
    expect(resolveConsequence({ ...base, configured: "FUN_ONLY" })).toEqual({
      kind: "fun",
    });
  });

  it("never silences a protected account", () => {
    expect(
      resolveConsequence({
        ...base,
        configured: "TEMPORARY_MUTE",
        targetIsProtected: true,
      }),
    ).toEqual({ kind: "degraded", why: "protected" });
  });

  it("checks protection BEFORE permissions", () => {
    // An admin in a group where the bot also lacks rights must be told they are
    // protected, not that the bot is broken.
    expect(
      resolveConsequence({
        ...base,
        configured: "TEMPORARY_MUTE",
        targetIsProtected: true,
        botCanRestrict: false,
      }),
    ).toEqual({ kind: "degraded", why: "protected" });
  });

  it("degrades honestly when the bot cannot restrict", () => {
    expect(
      resolveConsequence({
        ...base,
        configured: "TEMPORARY_MUTE",
        botCanRestrict: false,
      }),
    ).toEqual({ kind: "degraded", why: "no-permission" });
  });

  it("clamps the duration on the way out", () => {
    expect(
      resolveConsequence({
        ...base,
        configured: "TEMPORARY_MUTE",
        muteSeconds: 3,
      }),
    ).toEqual({ kind: "muted", seconds: MIN_MUTE_SECONDS });
  });
});

describe("cooldownVerdict", () => {
  const settings = { userCooldownSeconds: 30, chatCooldownSeconds: 5 };

  it("lets a first spin through", () => {
    expect(
      cooldownVerdict(
        settings,
        { lastUserSpinAt: null, lastChatSpinAt: null },
        at("2026-07-30T10:00:00Z"),
      ),
    ).toEqual({ allowed: true });
  });

  it("tells the throttled person about THEMSELVES, not the room", () => {
    const verdict = cooldownVerdict(
      settings,
      {
        lastUserSpinAt: at("2026-07-30T10:00:00Z"),
        lastChatSpinAt: at("2026-07-30T10:00:00Z"),
      },
      at("2026-07-30T10:00:10Z"),
    );
    expect(verdict).toEqual({ allowed: false, scope: "user", waitSeconds: 20 });
  });

  it("still throttles the room when this person has not span", () => {
    const verdict = cooldownVerdict(
      settings,
      {
        lastUserSpinAt: null,
        lastChatSpinAt: at("2026-07-30T10:00:00Z"),
      },
      at("2026-07-30T10:00:02Z"),
    );
    expect(verdict).toEqual({ allowed: false, scope: "chat", waitSeconds: 3 });
  });

  it("treats a timestamp from the future as a fresh spin", () => {
    // Replicas whose clocks disagree must not hand out a free pass.
    const verdict = cooldownVerdict(
      settings,
      {
        lastUserSpinAt: at("2026-07-30T10:05:00Z"),
        lastChatSpinAt: null,
      },
      at("2026-07-30T10:00:00Z"),
    );
    expect(verdict).toEqual({ allowed: false, scope: "user", waitSeconds: 30 });
  });

  it("honours a cooldown of zero as 'no cooldown'", () => {
    expect(
      cooldownVerdict(
        { userCooldownSeconds: 0, chatCooldownSeconds: 0 },
        {
          lastUserSpinAt: at("2026-07-30T10:00:00Z"),
          lastChatSpinAt: at("2026-07-30T10:00:00Z"),
        },
        at("2026-07-30T10:00:00Z"),
      ),
    ).toEqual({ allowed: true });
  });
});
