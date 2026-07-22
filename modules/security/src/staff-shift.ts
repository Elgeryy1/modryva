import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Staff shifts and on-duty guard. A shift assigns a staff member a window of
 * whole hours [startHour, endHour) on a 24h clock, including windows that wrap
 * past midnight (startHour > endHour). Pure and deterministic: callers supply
 * the current hour, so there is no clock access here.
 */

const HOURS_PER_DAY = 24;

/** A staff member on guard from `startHour` until `endHour` (24h clock). */
export interface Shift {
  readonly staffId: string;
  readonly startHour: number;
  readonly endHour: number;
}

/** True when `hour` is a whole hour in the range 0..23. */
const isValidHour = (hour: number): boolean =>
  Number.isInteger(hour) && hour >= 0 && hour < HOURS_PER_DAY;

/**
 * Wraps any finite hour into 0..23 (floored, positive modulo). Returns null for
 * non-finite input so callers can treat it as "no valid hour".
 */
const normalizeHour = (hour: number): number | null => {
  if (!Number.isFinite(hour)) {
    return null;
  }
  const floored = Math.floor(hour);
  return ((floored % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
};

/**
 * True when the shift covers `hour`. A window with startHour < endHour is a
 * normal same-day window [start, end). A window with startHour > endHour wraps
 * past midnight (on duty when hour >= start OR hour < end). A window with
 * startHour === endHour is a full 24h shift. Shifts with out-of-range hour
 * bounds are never active. Pure and deterministic.
 */
export const isShiftActive = (shift: Shift, hour: number): boolean => {
  const h = normalizeHour(hour);
  if (h === null) {
    return false;
  }
  if (!isValidHour(shift.startHour) || !isValidHour(shift.endHour)) {
    return false;
  }
  const { startHour, endHour } = shift;
  if (startHour === endHour) {
    return true;
  }
  if (startHour < endHour) {
    return h >= startHour && h < endHour;
  }
  return h >= startHour || h < endHour;
};

/**
 * Returns the staff ids on duty at `hour`, in the order the shifts appear and
 * without duplicates (a staffId with several covering shifts appears once).
 * Pure and deterministic.
 */
export const onDutyStaff = (
  shifts: readonly Shift[],
  hour: number,
): readonly string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const shift of shifts) {
    if (isShiftActive(shift, hour) && !seen.has(shift.staffId)) {
      seen.add(shift.staffId);
      result.push(shift.staffId);
    }
  }
  return result;
};

const pad2 = (hour: number): string => (hour < 10 ? `0${hour}` : `${hour}`);

/**
 * Builds the user-facing reply listing who is on guard at `hour`, e.g.
 * `"🛡️ De guardia a las 09:00: @ana, @bob"` or, when nobody covers it,
 * `"🛡️ Nadie de guardia a las 09:00."`. Pure and deterministic.
 */
export const buildOnDutyReply = (
  staffIds: readonly string[],
  hour: number,
): string => {
  const h = normalizeHour(hour);
  const label = h === null ? "esa hora" : `las ${pad2(h)}:00`;
  if (staffIds.length === 0) {
    return `🛡️ Nadie de guardia a ${label}.`;
  }
  return `🛡️ De guardia a ${label}: ${staffIds.join(", ")}`;
};

/** A parsed `/turno` subcommand. */
export type ShiftCommand =
  | {
      readonly kind: "set";
      readonly staffId: string;
      readonly startHour: number;
      readonly endHour: number;
    }
  | { readonly kind: "clear"; readonly staffId: string }
  | { readonly kind: "list" };

export interface ShiftCommandError {
  readonly code:
    | "missing-subcommand"
    | "unknown-subcommand"
    | "missing-args"
    | "invalid-hour";
  readonly usage: string;
}

export type ShiftCommandResult =
  | { readonly ok: true; readonly command: ShiftCommand }
  | { readonly ok: false; readonly error: ShiftCommandError };

export const SHIFT_COMMAND_USAGE =
  "Uso: /turno set <staff> <horaInicio> <horaFin> | clear <staff> | list";

const fail = (code: ShiftCommandError["code"]): ShiftCommandResult => ({
  ok: false,
  error: { code, usage: SHIFT_COMMAND_USAGE },
});

/** Parses a whole hour string in 0..23; returns null when out of range. */
const parseHour = (raw: string): number | null => {
  if (!/^\d{1,2}$/.test(raw)) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return isValidHour(value) ? value : null;
};

/**
 * Parses `/turno set|clear|list` into a discriminated command result. Returns
 * null when the update does not carry the `/turno` command. `set` needs a staff
 * id plus start/end hours (0..23); `clear` needs a staff id; `list` takes no
 * args. Pure and deterministic.
 */
export const parseShiftCommand = (
  update: TelegramUpdateEnvelope,
): ShiftCommandResult | null => {
  if (update.command?.name !== "turno") {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = args[0]?.toLowerCase();

  if (sub === undefined || sub.length === 0) {
    return fail("missing-subcommand");
  }

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub === "clear") {
    const staffId = (args[1] ?? "").trim();
    if (staffId.length === 0) {
      return fail("missing-args");
    }
    return { ok: true, command: { kind: "clear", staffId } };
  }

  if (sub === "set") {
    const staffId = (args[1] ?? "").trim();
    const startRaw = args[2];
    const endRaw = args[3];
    if (
      staffId.length === 0 ||
      startRaw === undefined ||
      endRaw === undefined
    ) {
      return fail("missing-args");
    }
    const startHour = parseHour(startRaw);
    const endHour = parseHour(endRaw);
    if (startHour === null || endHour === null) {
      return fail("invalid-hour");
    }
    return {
      ok: true,
      command: { kind: "set", staffId, startHour, endHour },
    };
  }

  return fail("unknown-subcommand");
};
