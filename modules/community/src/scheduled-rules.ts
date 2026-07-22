import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Time-of-day moderation windows: a group can be stricter at night or during
 * an "exam mode" quiet window. Each rule covers a half-open hour range
 * [startHour, endHour) on a 24h clock and carries a `strict` flag. The active
 * rule at a given hour decides whether the stricter policy applies. Pure
 * detection + config command; the ambient enforcement lives in the service.
 */

/**
 * A moderation window. `startHour`/`endHour` are integer hours in 0..23 on a
 * 24h clock and describe the half-open range [startHour, endHour). When
 * `startHour > endHour` the window crosses midnight (e.g. 22 -> 6). When
 * `startHour === endHour` the window covers the whole day. `strict` marks the
 * window as the tighter-moderation ("exam mode") one.
 */
export interface TimeRule {
  readonly startHour: number;
  readonly endHour: number;
  readonly strict: boolean;
}

const isValidHour = (hour: number): boolean =>
  Number.isInteger(hour) && hour >= 0 && hour <= 23;

/**
 * True when `hour` falls inside the rule's window. Supports midnight crossing
 * (start > end) and treats start === end as an all-day window. Rules with
 * out-of-range hours never match, and a non-integer or out-of-range `hour`
 * never matches. Pure and deterministic.
 */
export const isTimeRuleActive = (rule: TimeRule, hour: number): boolean => {
  if (
    !isValidHour(rule.startHour) ||
    !isValidHour(rule.endHour) ||
    !isValidHour(hour)
  ) {
    return false;
  }

  if (rule.startHour === rule.endHour) {
    return true;
  }

  if (rule.startHour < rule.endHour) {
    return hour >= rule.startHour && hour < rule.endHour;
  }

  return hour >= rule.startHour || hour < rule.endHour;
};

/**
 * Returns the first rule active at `hour`, or null when none apply. Order in
 * `rules` is the priority order. Supports midnight-crossing windows. Pure and
 * deterministic.
 */
export const activeTimeRule = (
  rules: readonly TimeRule[],
  hour: number,
): TimeRule | null => {
  for (const rule of rules) {
    if (isTimeRuleActive(rule, hour)) {
      return rule;
    }
  }
  return null;
};

/**
 * True when the active rule at `hour` is strict. No active rule means not
 * strict. Pure and deterministic.
 */
export const isStrictAtHour = (
  rules: readonly TimeRule[],
  hour: number,
): boolean => activeTimeRule(rules, hour)?.strict === true;

/**
 * Formats a rule's window as `"HH:00-HH:00"` using zero-padded hours, e.g.
 * `"22:00-06:00"`. Pure and deterministic.
 */
export const formatTimeRuleWindow = (rule: TimeRule): string => {
  const pad = (h: number): string => `${h < 10 ? "0" : ""}${h}:00`;
  return `${pad(rule.startHour)}-${pad(rule.endHour)}`;
};

/** A parsed `/schedulerule` request. */
export type ScheduledRuleCommand = {
  readonly startHour: number;
  readonly endHour: number;
  readonly strict: boolean;
};

/** Why a `/schedulerule` command could not be parsed. */
export interface ScheduledRuleCommandError {
  readonly code: "usage" | "invalid-hour" | "invalid-toggle";
  readonly message: string;
}

export type ScheduledRuleCommandResult =
  | { readonly ok: true; readonly command: ScheduledRuleCommand }
  | { readonly ok: false; readonly error: ScheduledRuleCommandError };

const scheduledRuleUsage =
  "Uso: /schedulerule <horaInicio 0-23> <horaFin 0-23> on|off";

const strictOn: ReadonlySet<string> = new Set(["on", "si", "true", "1"]);
const strictOff: ReadonlySet<string> = new Set(["off", "no", "false", "0"]);

const parseHour = (raw: string | undefined): number | null => {
  if (raw === undefined || !/^\d{1,2}$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return isValidHour(value) ? value : null;
};

/**
 * Parses `/schedulerule <startHour> <endHour> on|off`, where the hours are
 * integers in 0..23 and the toggle sets the `strict` flag. Returns an error
 * union for missing args, out-of-range hours or an unknown toggle, and null
 * when the update does not carry the command. Pure and deterministic.
 */
export const parseScheduledRuleCommand = (
  update: TelegramUpdateEnvelope,
): ScheduledRuleCommandResult | null => {
  const name = update.command?.name;

  if (name !== "schedulerule") {
    return null;
  }

  const args = update.command?.args ?? [];

  if (args.length < 3) {
    return {
      ok: false,
      error: { code: "usage", message: scheduledRuleUsage },
    };
  }

  const startHour = parseHour(args[0]);
  const endHour = parseHour(args[1]);

  if (startHour === null || endHour === null) {
    return {
      ok: false,
      error: {
        code: "invalid-hour",
        message: "Las horas deben ser numeros enteros entre 0 y 23.",
      },
    };
  }

  const toggle = (args[2] ?? "").toLowerCase();
  const strict = strictOn.has(toggle)
    ? true
    : strictOff.has(toggle)
      ? false
      : null;

  if (strict === null) {
    return {
      ok: false,
      error: { code: "invalid-toggle", message: scheduledRuleUsage },
    };
  }

  return { ok: true, command: { startHour, endHour, strict } };
};
