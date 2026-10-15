/**
 * Skeddy-style natural-language reminder parsing. Turns phrases like
 * "en 2 horas ...", "manana a las 17:00 ...", "a las 9 ..." into an absolute
 * run-at time, and formats that time back so the user can confirm the bot's
 * interpretation. Pure: all "now" comes in as a parameter (nowMs); a timezone
 * offset (minutes) is applied so wall-clock phrases resolve in the user's zone.
 */

const WEEKDAYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;
const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const pad = (n: number): string => n.toString().padStart(2, "0");

export interface NaturalReminder {
  readonly runAtMs: number;
  readonly message: string;
}

const clean = (raw: string | undefined): string => (raw ?? "").trim();

/**
 * Parses a natural-language reminder. Returns null when no pattern matches, so
 * the caller can fall back to the `/remind <minutes> <text>` format.
 */
export const parseNaturalReminder = (
  input: string,
  nowMs: number,
  tzOffsetMinutes = 0,
): NaturalReminder | null => {
  const text = input.trim();
  const offset = tzOffsetMinutes * 60_000;
  const localNow = nowMs + offset;

  // en N (min|horas|dias)
  const rel = /^en\s+(\d+)\s*(m|min|minutos?|h|horas?|d|dias?)\b(.*)$/iu.exec(
    text,
  );
  if (rel?.[1] && rel[2]) {
    const amount = Number.parseInt(rel[1], 10);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("h")
      ? 3_600_000
      : unit.startsWith("d")
        ? 86_400_000
        : 60_000;
    return {
      runAtMs: nowMs + amount * ms,
      message: clean(rel[3]) || "recordatorio",
    };
  }

  // (manana|hoy)? a las HH[:MM]
  const at =
    /^(?:(manana|mañana|hoy)\s+)?a\s+las\s+(\d{1,2})(?::(\d{2}))?\b(.*)$/iu.exec(
      text,
    );
  if (at?.[2]) {
    const when = at[1]?.toLowerCase();
    const hour = Number.parseInt(at[2], 10);
    const minute = at[3] ? Number.parseInt(at[3], 10) : 0;
    if (hour > 23 || minute > 59) {
      return null;
    }

    const dayMs = 86_400_000;
    const localMidnight = Math.floor(localNow / dayMs) * dayMs;
    let targetLocal = localMidnight + hour * 3_600_000 + minute * 60_000;

    if (when === "manana" || when === "mañana") {
      targetLocal += dayMs;
    } else if (when !== "hoy" && targetLocal <= localNow) {
      // Bare "a las" that already passed today rolls to tomorrow.
      targetLocal += dayMs;
    }

    return {
      runAtMs: targetLocal - offset,
      message: clean(at[4]) || "recordatorio",
    };
  }

  return null;
};

/**
 * Formats an absolute run-at time in the user's zone, e.g.
 * "vie 4 jul a las 17:00".
 */
export const formatReminderTime = (
  runAtMs: number,
  tzOffsetMinutes = 0,
): string => {
  const d = new Date(runAtMs + tzOffsetMinutes * 60_000);
  const weekday = WEEKDAYS[d.getUTCDay()] ?? "";
  const month = MONTHS[d.getUTCMonth()] ?? "";
  return `${weekday} ${d.getUTCDate()} ${month} a las ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
