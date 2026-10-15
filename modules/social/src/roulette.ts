/**
 * The virtual roulette.
 *
 * Everything about the game that could be got wrong lives here, as pure
 * functions over an injected RandomSource:
 *
 *  - the draw itself, so a test can state "this round loses" instead of
 *    fishing for a seed;
 *  - the mute duration clamp, because Telegram reads a restriction ending in
 *    under ~30 s as PERMANENT and the gateway does not check;
 *  - the cooldowns, which are the difference between a joke and a flood.
 *
 * What is NOT here: sanctions. This module decides that a round was adverse.
 * Applying that decision goes through ModerationPort, which is a facade over
 * the moderation path the bot already has.
 */

import type { RandomSource } from "./ports.js";
import {
  MAX_MUTE_SECONDS,
  MIN_MUTE_SECONDS,
  type RouletteConsequence,
  type RouletteSettings,
} from "./settings.js";

/** Bumped whenever the draw changes, so old audit rows stay interpretable. */
export const ROULETTE_RNG_VERSION = 1;

export type RouletteOutcome = "safe" | "adverse";

export interface RoundDecision {
  readonly outcome: RouletteOutcome;
  readonly numerator: number;
  readonly denominator: number;
  readonly rngVersion: number;
}

/**
 * Draws one round.
 *
 * `int(0, denominator)` gives a uniform value; the round is adverse when it
 * lands below the numerator. Comparing against the numerator rather than
 * testing a single "unlucky" value keeps 3/10 meaning three-in-ten instead of
 * one-in-ten-that-happens-to-be-a-3.
 *
 * The draw is never stored or exposed — publishing it would let anyone work out
 * when the next round is safe (report §6.8).
 */
export const decideRound = (
  settings: Pick<RouletteSettings, "numerator" | "denominator">,
  random: RandomSource,
): RoundDecision => {
  const denominator = Math.max(2, Math.trunc(settings.denominator));
  const numerator = Math.min(
    Math.max(1, Math.trunc(settings.numerator)),
    denominator - 1,
  );
  const draw = random.int(0, denominator);
  return {
    outcome: draw < numerator ? "adverse" : "safe",
    numerator,
    denominator,
    rngVersion: ROULETTE_RNG_VERSION,
  };
};

/**
 * The mute length actually safe to ask Telegram for.
 *
 * Telegram's `until_date` semantics: less than 30 seconds away, or more than
 * 366 days away, means "forever". A group that types 5 in a settings box means
 * five seconds of fun and would get a permanent silence. Clamping here — in the
 * domain, before anything touches the API — is the only place that guarantee
 * holds for every caller.
 */
export const safeMuteSeconds = (requested: number): number => {
  if (!Number.isFinite(requested)) {
    return MIN_MUTE_SECONDS;
  }
  const whole = Math.trunc(requested);
  if (whole < MIN_MUTE_SECONDS) {
    return MIN_MUTE_SECONDS;
  }
  return whole > MAX_MUTE_SECONDS ? MAX_MUTE_SECONDS : whole;
};

/** Spanish duration for the reply: "1 minuto", "5 minutos", "2 horas". */
export const formatMuteDuration = (seconds: number): string => {
  const safe = safeMuteSeconds(seconds);
  if (safe < 3600) {
    const minutes = Math.round(safe / 60);
    return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  }
  const hours = Math.round(safe / 3600);
  return hours === 1 ? "1 hora" : `${hours} horas`;
};

export type CooldownVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly scope: "user" | "chat";
      readonly waitSeconds: number;
    };

export interface CooldownState {
  /** When this person last span, or null. */
  readonly lastUserSpinAt: Date | null;
  /** When ANYONE last span in this chat, or null. */
  readonly lastChatSpinAt: Date | null;
}

/**
 * Whether this spin may proceed.
 *
 * Two cooldowns with different jobs: the per-user one stops one person
 * spamming, the per-chat one stops twenty people discovering the command at
 * once and turning the group into a wall of gun emoji. The user cooldown is
 * checked first so the person who is actually being throttled is told about
 * themselves, not about the room.
 */
export const cooldownVerdict = (
  settings: Pick<
    RouletteSettings,
    "userCooldownSeconds" | "chatCooldownSeconds"
  >,
  state: CooldownState,
  now: Date,
): CooldownVerdict => {
  const remaining = (since: Date | null, cooldown: number): number => {
    if (since === null || cooldown <= 0) {
      return 0;
    }
    const elapsed = (now.getTime() - since.getTime()) / 1000;
    // A negative elapsed means the stored timestamp is in the future (clock
    // skew between replicas). Treat it as "just span" rather than as a licence.
    return elapsed < 0 ? cooldown : Math.max(0, Math.ceil(cooldown - elapsed));
  };

  const userWait = remaining(
    state.lastUserSpinAt,
    settings.userCooldownSeconds,
  );
  if (userWait > 0) {
    return { allowed: false, scope: "user", waitSeconds: userWait };
  }
  const chatWait = remaining(
    state.lastChatSpinAt,
    settings.chatCooldownSeconds,
  );
  if (chatWait > 0) {
    return { allowed: false, scope: "chat", waitSeconds: chatWait };
  }
  return { allowed: true };
};

/**
 * What an adverse round actually costs, once reality is taken into account.
 *
 * Degrading to FUN_ONLY is a first-class outcome, not an error: a group that
 * configured a mute but never gave the bot `can_restrict_members` should get a
 * playable game plus an honest explanation, not a silent no-op (report §6.5).
 */
export type AppliedConsequence =
  | { readonly kind: "fun" }
  | { readonly kind: "muted"; readonly seconds: number }
  | { readonly kind: "degraded"; readonly why: "no-permission" | "protected" };

export interface ConsequenceInputs {
  readonly configured: RouletteConsequence;
  readonly muteSeconds: number;
  readonly botCanRestrict: boolean;
  /** Admins, the creator and the bot itself are never silenced. */
  readonly targetIsProtected: boolean;
}

export const resolveConsequence = (
  inputs: ConsequenceInputs,
): AppliedConsequence => {
  if (inputs.configured === "FUN_ONLY") {
    return { kind: "fun" };
  }
  if (inputs.targetIsProtected) {
    return { kind: "degraded", why: "protected" };
  }
  if (!inputs.botCanRestrict) {
    return { kind: "degraded", why: "no-permission" };
  }
  return { kind: "muted", seconds: safeMuteSeconds(inputs.muteSeconds) };
};
