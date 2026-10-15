/**
 * Per-group social settings.
 *
 * Stored as ONE json value under the `social` key of the existing ChatSetting
 * store, so there is no new settings table and multi-bot isolation comes free
 * (ChatSetting is keyed by tenantId, which IS the bot identity in this repo).
 *
 * Everything here is pure: shape, defaults and a normalizer. The normalizer is
 * the important part — it always returns a COMPLETE settings object. A field
 * that is missing (older row), the wrong type (hand-edited json) or out of
 * range falls back to its default instead of throwing, because a corrupt
 * settings row must not be able to take `/pole` down for a group.
 */

/** How the pole is claimed. See KNOWN_GAPS D5 for why COMMAND_CLAIM is default. */
export const POLE_CLAIM_MODES = [
  "COMMAND_CLAIM",
  "AUTO_FIRST_MESSAGE",
] as const;
export type PoleClaimMode = (typeof POLE_CLAIM_MODES)[number];

/** Whether a forum group keeps one competition or one per topic. */
export const THREAD_SCOPES = ["shared", "per-topic"] as const;
export type ThreadScope = (typeof THREAD_SCOPES)[number];

/** What losing a roulette round costs. */
export const ROULETTE_CONSEQUENCES = ["FUN_ONLY", "TEMPORARY_MUTE"] as const;
export type RouletteConsequence = (typeof ROULETTE_CONSEQUENCES)[number];

/**
 * Telegram treats a restriction ending in under ~30 s (and over 366 days) as
 * PERMANENT. 60 s is the smallest value that is unambiguously temporary with
 * room for clock skew, and it is the floor the report asks for (§6.5).
 */
export const MIN_MUTE_SECONDS = 60;
export const MAX_MUTE_SECONDS = 24 * 60 * 60;

/** A day has 1440 minutes; the reset is an offset from local midnight. */
export const MAX_RESET_MINUTES = 24 * 60 - 1;

/** Top-N cap. Beyond this the daily post stops being a one-line ritual. */
export const MAX_POLE_POSITIONS = 10;

export interface PoleSettings {
  readonly enabled: boolean;
  readonly mode: PoleClaimMode;
  /** IANA zone, e.g. "Europe/Madrid". Validated by trying to format with it. */
  readonly timezone: string;
  /** Minutes after local midnight when a new window opens. */
  readonly resetMinutes: number;
  /** How many places are awarded (1 = pole only). */
  readonly positions: number;
  readonly threadScope: ThreadScope;
  /** In AUTO_FIRST_MESSAGE, whether a photo/sticker/GIF can take the pole. */
  readonly allowMedia: boolean;
  /** Post a short summary when the window's last place is taken. */
  readonly summaryEnabled: boolean;
}

export interface RouletteSettings {
  readonly enabled: boolean;
  readonly consequence: RouletteConsequence;
  /** Adverse outcomes per `denominator` draws. */
  readonly numerator: number;
  readonly denominator: number;
  readonly muteSeconds: number;
  readonly userCooldownSeconds: number;
  readonly chatCooldownSeconds: number;
}

export interface FunSettings {
  readonly pauloEnabled: boolean;
  readonly catsEnabled: boolean;
  readonly dogsEnabled: boolean;
}

export interface SocialSettings {
  readonly pole: PoleSettings;
  readonly roulette: RouletteSettings;
  readonly fun: FunSettings;
  /** Where `/apoyar` sends people. Empty string = the command stays quiet. */
  readonly supportUrl: string;
}

/**
 * Factory defaults: everything OFF except pole-by-command.
 *
 * Deploying this module must not change how a single existing group behaves.
 * A group opts in; nothing opts it in for them.
 */
export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  pole: {
    enabled: false,
    mode: "COMMAND_CLAIM",
    timezone: "Europe/Madrid",
    resetMinutes: 0,
    positions: 3,
    threadScope: "shared",
    allowMedia: false,
    summaryEnabled: false,
  },
  roulette: {
    enabled: false,
    consequence: "FUN_ONLY",
    numerator: 1,
    denominator: 6,
    muteSeconds: MIN_MUTE_SECONDS,
    userCooldownSeconds: 30,
    chatCooldownSeconds: 5,
  },
  fun: { pauloEnabled: false, catsEnabled: false, dogsEnabled: false },
  supportUrl: "",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const boolOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const intInRange = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }
  return value < min || value > max ? fallback : value;
};

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/**
 * True when the runtime can actually format a date in this zone.
 *
 * A stored zone is just a string; `Intl` is the only authority on whether it
 * resolves. Checking here means the window maths downstream never has to
 * consider the possibility of a bad zone.
 */
export const isValidTimezone = (zone: unknown): zone is string => {
  if (typeof zone !== "string" || zone.length === 0 || zone.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
};

/**
 * A support URL we are willing to put behind a button.
 *
 * https only, no credentials in the authority, length-capped. An admin types
 * this and every member of the group taps it, so it is untrusted input on the
 * way to other people's screens.
 */
export const isSafeSupportUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 300) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
};

/**
 * Turns whatever is in the settings row into a complete, in-range
 * SocialSettings. Never throws. Unknown input yields the factory defaults.
 */
export const normalizeSocialSettings = (raw: unknown): SocialSettings => {
  const root = asRecord(raw);
  const pole = asRecord(root.pole);
  const roulette = asRecord(root.roulette);
  const fun = asRecord(root.fun);
  const d = DEFAULT_SOCIAL_SETTINGS;

  // Read the probability as a pair, then reject the pair: a numerator that is
  // valid on its own can still be >= the denominator, which would mean "every
  // round loses" — never what an admin means to configure.
  const denominator = intInRange(
    roulette.denominator,
    2,
    100,
    d.roulette.denominator,
  );
  const numeratorRaw = intInRange(
    roulette.numerator,
    1,
    99,
    d.roulette.numerator,
  );
  const numerator =
    numeratorRaw < denominator ? numeratorRaw : d.roulette.numerator;

  return {
    pole: {
      enabled: boolOr(pole.enabled, d.pole.enabled),
      mode: oneOf(pole.mode, POLE_CLAIM_MODES, d.pole.mode),
      timezone: isValidTimezone(pole.timezone)
        ? pole.timezone
        : d.pole.timezone,
      resetMinutes: intInRange(
        pole.resetMinutes,
        0,
        MAX_RESET_MINUTES,
        d.pole.resetMinutes,
      ),
      positions: intInRange(
        pole.positions,
        1,
        MAX_POLE_POSITIONS,
        d.pole.positions,
      ),
      threadScope: oneOf(pole.threadScope, THREAD_SCOPES, d.pole.threadScope),
      allowMedia: boolOr(pole.allowMedia, d.pole.allowMedia),
      summaryEnabled: boolOr(pole.summaryEnabled, d.pole.summaryEnabled),
    },
    roulette: {
      enabled: boolOr(roulette.enabled, d.roulette.enabled),
      consequence: oneOf(
        roulette.consequence,
        ROULETTE_CONSEQUENCES,
        d.roulette.consequence,
      ),
      numerator,
      denominator,
      muteSeconds: intInRange(
        roulette.muteSeconds,
        MIN_MUTE_SECONDS,
        MAX_MUTE_SECONDS,
        d.roulette.muteSeconds,
      ),
      userCooldownSeconds: intInRange(
        roulette.userCooldownSeconds,
        0,
        3600,
        d.roulette.userCooldownSeconds,
      ),
      chatCooldownSeconds: intInRange(
        roulette.chatCooldownSeconds,
        0,
        3600,
        d.roulette.chatCooldownSeconds,
      ),
    },
    fun: {
      pauloEnabled: boolOr(fun.pauloEnabled, d.fun.pauloEnabled),
      catsEnabled: boolOr(fun.catsEnabled, d.fun.catsEnabled),
      dogsEnabled: boolOr(fun.dogsEnabled, d.fun.dogsEnabled),
    },
    supportUrl: isSafeSupportUrl(root.supportUrl) ? root.supportUrl : "",
  };
};

/** The ChatSetting key. Must match `SOCIAL_SETTINGS_KEY` in packages/shared. */
export const SOCIAL_SETTINGS_KEY = "social";

/**
 * The competition a claim belongs to.
 *
 * `threadId` is null whenever the group shares one competition, which is the
 * default. Deriving it in ONE place is what stops half the module from scoping
 * by topic and the other half from ignoring topics.
 */
export interface SocialScope {
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly threadId: number | null;
}

export const scopeFor = (
  tenantId: string,
  chatId: bigint,
  topicId: number | null | undefined,
  settings: PoleSettings,
): SocialScope => ({
  tenantId,
  chatId,
  threadId:
    settings.threadScope === "per-topic" && typeof topicId === "number"
      ? topicId
      : null,
});
