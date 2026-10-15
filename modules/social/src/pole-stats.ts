/**
 * Rankings, streaks and records, computed from claims.
 *
 * There is no materialised stats table on purpose. `PoleClaim` is the source of
 * truth (report §12.4), and a projection that can drift from it is a second
 * source of truth wearing a hat. These functions are pure, so the same code
 * answers `/pole ranking` in the bot and the leaderboard in the Mini App.
 */

/** One awarded position, as the repositories hand it over. */
export interface ClaimRecord {
  /** Telegram id as a string: it is a map key here, never arithmetic. */
  readonly userId: string;
  readonly userName: string | null;
  /** 1 = pole, 2 = subpole, 3 = bronze, … */
  readonly position: number;
  /** Local calendar day the window opened, "YYYY-MM-DD". */
  readonly dayKey: string;
  readonly latencyMs: number;
}

export interface RankingRow {
  readonly userId: string;
  readonly userName: string | null;
  readonly firsts: number;
  readonly seconds: number;
  readonly thirds: number;
  readonly total: number;
}

/**
 * Leaderboard, best first.
 *
 * Ordered by golds, then silvers, then bronzes, then total appearances. No
 * invented point weighting: the report does not know the original tie-break
 * rules (§2.3), so inventing "a pole is worth 3.5 subpoles" would be a made-up
 * number presented as a fact. Lexicographic on the medals is defensible and
 * needs no footnote.
 */
export const rankingFrom = (
  claims: readonly ClaimRecord[],
): readonly RankingRow[] => {
  const byUser = new Map<string, RankingRow>();
  for (const claim of claims) {
    const prior = byUser.get(claim.userId) ?? {
      userId: claim.userId,
      userName: claim.userName,
      firsts: 0,
      seconds: 0,
      thirds: 0,
      total: 0,
    };
    byUser.set(claim.userId, {
      ...prior,
      // Keep the freshest name we have seen rather than the first: people
      // rename themselves and a months-old label is worse than none.
      userName: claim.userName ?? prior.userName,
      firsts: prior.firsts + (claim.position === 1 ? 1 : 0),
      seconds: prior.seconds + (claim.position === 2 ? 1 : 0),
      thirds: prior.thirds + (claim.position === 3 ? 1 : 0),
      total: prior.total + 1,
    });
  }
  return [...byUser.values()].sort(
    (a, b) =>
      b.firsts - a.firsts ||
      b.seconds - a.seconds ||
      b.thirds - a.thirds ||
      b.total - a.total ||
      // Final tie-break by id so the order is stable between calls; without it
      // two people with identical records could swap places on every refresh.
      a.userId.localeCompare(b.userId),
  );
};

/** "2026-07-30" -> "2026-07-29". Pure calendar arithmetic, no timezone in play. */
export const previousDayKey = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-").map((part) => Number.parseInt(part, 10));
  // parseInt("no") is NaN, not undefined — checking only for undefined would
  // turn a malformed key into the string "NaN-NaN-NaN" and quietly poison every
  // streak that walked through it.
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return dayKey;
  }
  const stamp = Date.UTC(y, m - 1, d) - 24 * 3600 * 1000;
  const back = new Date(stamp);
  const mm = String(back.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(back.getUTCDate()).padStart(2, "0");
  return `${back.getUTCFullYear()}-${mm}-${dd}`;
};

const winDays = (
  claims: readonly ClaimRecord[],
  userId: string,
): ReadonlySet<string> => {
  const days = new Set<string>();
  for (const claim of claims) {
    if (claim.userId === userId && claim.position === 1) {
      days.add(claim.dayKey);
    }
  }
  return days;
};

/**
 * Consecutive days this person has taken the pole, counting back from today.
 *
 * `todayKey` is passed in rather than read from a clock so the caller decides
 * which timezone "today" means — the group's, not the server's.
 *
 * Today not being claimed yet does NOT break the streak: the window is still
 * open, so counting from yesterday is the honest reading. A day the group
 * simply did not play does break it, which is the report's recommended default
 * (§5.8) because it is what keeps the thing a daily ritual.
 *
 * But today's pole going to SOMEONE ELSE breaks it immediately. "Nobody has
 * claimed yet" and "you already lost today" look the same if you only ask
 * whether this person won today — and treating the second as the first would
 * keep announcing a streak that has already ended.
 */
export const currentStreak = (
  claims: readonly ClaimRecord[],
  userId: string,
  todayKey: string,
): number => {
  const todayWinner = claims.find(
    (claim) => claim.dayKey === todayKey && claim.position === 1,
  );
  return streakFromWinDays(
    [...winDays(claims, userId)],
    todayWinner?.userId ?? null,
    userId,
    todayKey,
  );
};

/**
 * La misma racha, pero a partir de los DÍAS ganados en vez de las
 * reclamaciones.
 *
 * Existe porque la versión de arriba obliga a cargar el historial entero, y eso
 * no escala: un grupo con años de juego tiene decenas de miles de
 * reclamaciones y como mucho unos cientos de días ganados. La base de datos
 * puede devolver los días directamente.
 *
 * `currentStreak` delega aquí, así que las dos rutas comparten la lógica por
 * construcción y no por un test que alguien tenga que recordar escribir.
 *
 * `todayWinnerId` es quién se llevó la pole de HOY (null si aún nadie): es el
 * dato que los días propios no pueden contener y sin el cual una racha ya
 * perdida se sigue anunciando.
 */
export const streakFromWinDays = (
  winDayKeys: readonly string[],
  todayWinnerId: string | null,
  userId: string,
  todayKey: string,
): number => {
  if (todayWinnerId !== null && todayWinnerId !== userId) {
    return 0;
  }
  const days = new Set(winDayKeys);
  let cursor = days.has(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
};

/**
 * El prefijo de `dayKey` que corresponde a un periodo.
 *
 * `null` = sin filtro. Se usa para que el filtrado por mes o año sea un escaneo
 * de prefijo en SQL en lugar de una conversión de zona horaria por fila.
 */
export const dayPrefixFor = (
  period: "day" | "month" | "year" | "all",
  todayKey: string,
): string | null => {
  switch (period) {
    case "day":
      return todayKey;
    case "month":
      return todayKey.slice(0, 7);
    case "year":
      return todayKey.slice(0, 4);
    default:
      return null;
  }
};

/** The longest run this person has ever put together. */
export const bestStreak = (
  claims: readonly ClaimRecord[],
  userId: string,
): number => {
  const days = [...winDays(claims, userId)].sort();
  let best = 0;
  let run = 0;
  let expected: string | null = null;
  for (const day of days) {
    run = expected !== null && day === expected ? run + 1 : 1;
    best = Math.max(best, run);
    expected = nextDayKey(day);
  }
  return best;
};

/** "2026-07-30" -> "2026-07-31". */
export const nextDayKey = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-").map((part) => Number.parseInt(part, 10));
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return dayKey;
  }
  const forward = new Date(Date.UTC(y, m - 1, d) + 24 * 3600 * 1000);
  const mm = String(forward.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(forward.getUTCDate()).padStart(2, "0");
  return `${forward.getUTCFullYear()}-${mm}-${dd}`;
};

export interface PoleRecords {
  readonly fastest: ClaimRecord | null;
  readonly bestStreakUserId: string | null;
  readonly bestStreakUserName: string | null;
  readonly bestStreakDays: number;
}

/**
 * The group's hall of fame.
 *
 * "Fastest" only ever considers first places: a subpole taken four seconds
 * after the pole is not a fast claim, it is a fast reaction to someone else.
 */
export const recordsFrom = (claims: readonly ClaimRecord[]): PoleRecords => {
  let fastest: ClaimRecord | null = null;
  for (const claim of claims) {
    if (claim.position !== 1) {
      continue;
    }
    if (fastest === null || claim.latencyMs < fastest.latencyMs) {
      fastest = claim;
    }
  }

  let bestUserId: string | null = null;
  let bestName: string | null = null;
  let bestDays = 0;
  for (const userId of new Set(claims.map((claim) => claim.userId))) {
    const streak = bestStreak(claims, userId);
    if (streak > bestDays) {
      bestDays = streak;
      bestUserId = userId;
      bestName =
        claims.find((claim) => claim.userId === userId)?.userName ?? null;
    }
  }

  return {
    fastest,
    bestStreakUserId: bestUserId,
    bestStreakUserName: bestName,
    bestStreakDays: bestDays,
  };
};

/** Keeps only the claims whose day falls in the given period. */
export const filterByPeriod = (
  claims: readonly ClaimRecord[],
  period: "day" | "month" | "year" | "all",
  todayKey: string,
): readonly ClaimRecord[] => {
  if (period === "all") {
    return claims;
  }
  const prefix =
    period === "day"
      ? todayKey
      : period === "month"
        ? todayKey.slice(0, 7)
        : todayKey.slice(0, 4);
  return claims.filter((claim) => claim.dayKey.startsWith(prefix));
};
