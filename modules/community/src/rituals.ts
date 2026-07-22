import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Automatic recurring rituals (e.g. Monday question threads, Friday clip
 * dumps). A ritual fires once a week when the current `weekday` and `hour`
 * match. Times are plain integers supplied by the caller so this module stays
 * pure and deterministic; no clock, timezone or scheduler logic lives here.
 *
 * - `weekday`: 0 (Sunday) .. 6 (Saturday).
 * - `hour`: 0 .. 23 (local hour decided by the caller).
 * - `message`: text the bot posts when the ritual is due.
 */
export interface Ritual {
  readonly weekday: number;
  readonly hour: number;
  readonly message: string;
}

/** Lowest and highest valid weekday (inclusive). */
export const RITUAL_MIN_WEEKDAY = 0;
export const RITUAL_MAX_WEEKDAY = 6;
/** Lowest and highest valid hour (inclusive). */
export const RITUAL_MIN_HOUR = 0;
export const RITUAL_MAX_HOUR = 23;

const isIntInRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * True when `value` is a valid weekday (integer 0..6). Pure and deterministic.
 */
export const isRitualWeekday = (value: number): boolean =>
  isIntInRange(value, RITUAL_MIN_WEEKDAY, RITUAL_MAX_WEEKDAY);

/**
 * True when `value` is a valid hour (integer 0..23). Pure and deterministic.
 */
export const isRitualHour = (value: number): boolean =>
  isIntInRange(value, RITUAL_MIN_HOUR, RITUAL_MAX_HOUR);

/**
 * True when the ritual should fire at the given `weekday`/`hour`. A ritual
 * with an out-of-range weekday or hour never fires. Pure and deterministic.
 */
export const isRitualDue = (
  ritual: Ritual,
  weekday: number,
  hour: number,
): boolean =>
  isRitualWeekday(ritual.weekday) &&
  isRitualHour(ritual.hour) &&
  ritual.weekday === weekday &&
  ritual.hour === hour;

/**
 * Returns the rituals due at the given `weekday`/`hour`, preserving the input
 * order. Returns an empty array when the target time is invalid or nothing
 * matches. Never returns duplicates beyond those already in the input. Pure
 * and deterministic.
 */
export const dueRituals = (
  rituals: readonly Ritual[],
  weekday: number,
  hour: number,
): readonly Ritual[] => {
  if (!isRitualWeekday(weekday) || !isRitualHour(hour)) {
    return [];
  }
  return rituals.filter((ritual) => isRitualDue(ritual, weekday, hour));
};

const WEEKDAY_NAMES: readonly string[] = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

/**
 * Human-readable Spanish label for a ritual, e.g.
 * `"lunes 09:00 -> Comparte tu pregunta"`. Falls back to the numeric weekday
 * when it is out of range. Pure and deterministic.
 */
export const formatRitual = (ritual: Ritual): string => {
  const name = isRitualWeekday(ritual.weekday)
    ? (WEEKDAY_NAMES[ritual.weekday] ?? String(ritual.weekday))
    : String(ritual.weekday);
  const hh = isRitualHour(ritual.hour)
    ? String(ritual.hour).padStart(2, "0")
    : String(ritual.hour);
  return `${name} ${hh}:00 -> ${ritual.message}`;
};

export type RitualCommand =
  | { readonly kind: "add"; readonly ritual: Ritual }
  | { readonly kind: "list" }
  | {
      readonly kind: "remove";
      readonly weekday: number;
      readonly hour: number;
    };

export interface RitualCommandError {
  readonly code:
    | "missing-subcommand"
    | "unknown-subcommand"
    | "missing-args"
    | "invalid-weekday"
    | "invalid-hour"
    | "missing-message";
  readonly usage: string;
}

export type RitualCommandResult =
  | { readonly ok: true; readonly command: RitualCommand }
  | { readonly ok: false; readonly error: RitualCommandError };

const USAGE_ROOT = "Uso: /ritual add|list|remove";
const USAGE_ADD = "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>";
const USAGE_REMOVE = "Uso: /ritual remove <dia 0-6> <hora 0-23>";

const fail = (
  code: RitualCommandError["code"],
  usage: string,
): RitualCommandResult => ({ ok: false, error: { code, usage } });

/**
 * Parses an integer from a token. Returns null for undefined or anything that
 * is not a base-10 integer (e.g. "1.5", "x", ""). Pure and deterministic.
 */
const parseIntToken = (token: string | undefined): number | null => {
  if (token === undefined || !/^-?\d+$/.test(token)) {
    return null;
  }
  return Number.parseInt(token, 10);
};

/**
 * Parses `/ritual add|list|remove`. Returns a discriminated ok/error result,
 * or null when the update does not carry the `/ritual` command. Subcommands
 * are matched exactly (add | list | remove), so there is no keyword overlap.
 *
 * - `add <dia> <hora> <mensaje...>`: dia 0..6, hora 0..23, message required.
 * - `list`: no arguments.
 * - `remove <dia> <hora>`: identifies the ritual to drop by weekday and hour.
 *
 * Pure and deterministic: reads only the parsed command envelope.
 */
export const parseRitualCommand = (
  update: TelegramUpdateEnvelope,
): RitualCommandResult | null => {
  if (update.command?.name !== "ritual") {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = args[0]?.toLowerCase();

  if (sub === undefined || sub.length === 0) {
    return fail("missing-subcommand", USAGE_ROOT);
  }

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub === "add") {
    const weekday = parseIntToken(args[1]);
    const hour = parseIntToken(args[2]);
    if (weekday === null || hour === null) {
      return fail("missing-args", USAGE_ADD);
    }
    if (!isRitualWeekday(weekday)) {
      return fail("invalid-weekday", USAGE_ADD);
    }
    if (!isRitualHour(hour)) {
      return fail("invalid-hour", USAGE_ADD);
    }
    const message = args.slice(3).join(" ").trim();
    if (message.length === 0) {
      return fail("missing-message", USAGE_ADD);
    }
    return {
      ok: true,
      command: { kind: "add", ritual: { weekday, hour, message } },
    };
  }

  if (sub === "remove") {
    const weekday = parseIntToken(args[1]);
    const hour = parseIntToken(args[2]);
    if (weekday === null || hour === null) {
      return fail("missing-args", USAGE_REMOVE);
    }
    if (!isRitualWeekday(weekday)) {
      return fail("invalid-weekday", USAGE_REMOVE);
    }
    if (!isRitualHour(hour)) {
      return fail("invalid-hour", USAGE_REMOVE);
    }
    return { ok: true, command: { kind: "remove", weekday, hour } };
  }

  return fail("unknown-subcommand", USAGE_ROOT);
};
