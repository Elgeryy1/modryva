/**
 * The daily competition window, derived from the group's timezone and reset
 * time — never from a cron.
 *
 * This is the single most important decision in the module. If a scheduled job
 * owned "the day", then a container that was down at midnight, a job that ran
 * late, or a clock change would all silently produce a wrong or missing
 * competition. Instead the window is RECOMPUTED from first principles every
 * time somebody claims, so the answer is the same whether the process has been
 * up for a month or started four seconds ago.
 *
 * Pure: the current instant is an argument, and the IANA rules come from the
 * runtime's own `Intl` database.
 */

export interface PoleWindow {
  /** Inclusive UTC instant the window opened. */
  readonly startsAt: Date;
  /** Exclusive UTC instant the next window opens. */
  readonly endsAt: Date;
  readonly timezone: string;
  readonly resetMinutes: number;
}

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const partFormatter = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  const cached = partFormatter.get(timezone);
  if (cached) {
    return cached;
  }
  const made = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // h23 so midnight reads as 00 and never as 24, which would push the date.
    hourCycle: "h23",
  });
  partFormatter.set(timezone, made);
  return made;
};

/** Wall-clock reading of `instant` in `timezone`. */
export const localPartsIn = (instant: Date, timezone: string): LocalParts => {
  const parts = formatterFor(timezone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type)?.value ?? "0";
    return Number.parseInt(found, 10);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

/**
 * The zone's UTC offset, in ms, AT a given instant.
 *
 * Derived rather than looked up: format the instant in the zone, re-read that
 * wall time as if it were UTC, and the difference is the offset. This is the
 * only way to get a historically correct offset (including DST) out of `Intl`
 * without shipping a timezone library.
 */
const offsetMsAt = (instant: Date, timezone: string): number => {
  const p = localPartsIn(instant, timezone);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asIfUtc - instant.getTime();
};

/**
 * The UTC instant of a local wall-clock time.
 *
 * Two passes, because the offset depends on the answer we are looking for. The
 * first guess uses the offset at the wall time read as UTC; if the instant that
 * produces sits on the other side of a DST transition, the second pass corrects
 * it.
 *
 * Both awkward cases resolve to a single, well-defined instant:
 *  - Spring forward: the requested wall time never happens. The result lands
 *    just after the jump, so the day is simply an hour shorter.
 *  - Autumn: the wall time happens twice. The result is the SECOND occurrence
 *    (after the clocks go back), so that day is an hour longer.
 * Either way the window opens exactly once — which is the property that
 * matters, and the one `poleWindowFor` guarantees regardless of this choice.
 */
const localToUtc = (
  year: number,
  month: number,
  day: number,
  minutes: number,
  timezone: string,
): Date => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const first = offsetMsAt(new Date(guess), timezone);
  const candidate = guess - first;
  const second = offsetMsAt(new Date(candidate), timezone);
  return new Date(second === first ? candidate : guess - second);
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window `now` falls into.
 *
 * Rather than doing arithmetic on "start + 24h" (which is wrong on any day a
 * clock changes), this builds the reset instant for yesterday, today and
 * tomorrow in local terms and then simply asks which pair brackets `now`. The
 * windows are contiguous by construction — one window's end IS the next one's
 * start — so no day can be skipped or counted twice.
 */
export const poleWindowFor = (
  now: Date,
  timezone: string,
  resetMinutes: number,
): PoleWindow => {
  const local = localPartsIn(now, timezone);
  // Walk the local calendar via UTC arithmetic on the DATE only: adding a day
  // to a Y/M/D triple has no DST hazard, unlike adding 24h to an instant.
  const localMidday = Date.UTC(local.year, local.month - 1, local.day, 12);

  const candidates: Date[] = [];
  for (const shift of [-1, 0, 1]) {
    const d = new Date(localMidday + shift * DAY_MS);
    candidates.push(
      localToUtc(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        resetMinutes,
        timezone,
      ),
    );
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());

  let startsAt = candidates[0] as Date;
  let endsAt = candidates[candidates.length - 1] as Date;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i] as Date;
    if (candidate.getTime() <= now.getTime()) {
      startsAt = candidate;
      const next = candidates[i + 1];
      if (next) {
        endsAt = next;
      }
    }
  }

  return { startsAt, endsAt, timezone, resetMinutes };
};

/**
 * How long after the window opened this claim landed.
 *
 * Clamped at zero: a claim can never predate its own window, and a negative
 * number here would poison the "fastest ever" record forever.
 */
export const latencyMsFor = (window: PoleWindow, at: Date): number =>
  Math.max(0, at.getTime() - window.startsAt.getTime());

/**
 * Human latency, Spanish, chosen by magnitude.
 *
 * The reset is usually midnight, so a real first claim is often hours after the
 * window opened. Printing "32 400 000 ms" or "32400,0 s" would be true and
 * useless; the unit has to follow the number.
 */
export const formatLatency = (ms: number): string => {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  }
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

/**
 * Stable label for the window's local day, e.g. "2026-07-30".
 *
 * Used for monthly/yearly grouping and for the window's human name. Derived
 * from the START instant, so a window that opens at 06:00 belongs to the day it
 * opened, not to whatever day it happens to be when someone claims.
 */
export const windowDayKey = (window: PoleWindow): string => {
  const p = localPartsIn(window.startsAt, window.timezone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
};
