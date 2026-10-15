/**
 * Tuning options for {@link checkAnnouncementFrequency}. Both fields are
 * optional; omitted values fall back to the module defaults. Values are
 * clamped to sane ranges by the checker (non-negative, integer max).
 */
export interface AnnouncementFrequencyOptions {
  /** Length of the look-back window in milliseconds. Defaults to 24h. */
  readonly windowMs?: number;
  /** Max announcements allowed inside the window before warning. Defaults to 3. */
  readonly maxInWindow?: number;
}

/**
 * Outcome of an announcement-frequency check: whether the rate is too high,
 * how many announcements fall inside the window, and a user-facing Spanish tip.
 */
export interface AnnouncementFrequencyResult {
  /** True when countInWindow exceeds the allowed maximum. */
  readonly tooMany: boolean;
  /** Number of timestamps inside the inclusive window. */
  readonly countInWindow: number;
  /** User-facing Spanish advice string (with emojis). */
  readonly advice: string;
}

/** Default look-back window: 24 hours in milliseconds. */
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Default maximum announcements tolerated inside the window. */
const DEFAULT_MAX_IN_WINDOW = 3;

/**
 * Builds the user-facing Spanish advice for a given count and limit.
 * Plain function of its inputs. Pure and deterministic.
 */
const buildAdvice = (
  countInWindow: number,
  maxInWindow: number,
  tooMany: boolean,
): string => {
  if (tooMany) {
    return `⚠️ Llevas ${countInWindow} anuncios recientes y el límite es ${maxInWindow}. Espera un poco antes de publicar otro para no saturar el grupo. 🙏`;
  }
  if (countInWindow === 0) {
    return "✅ No hay anuncios recientes. Puedes publicar con tranquilidad.";
  }
  if (countInWindow >= maxInWindow) {
    return `📢 Vas ${countInWindow} de ${maxInWindow} anuncios. Has llegado al límite recomendado; si puedes, agrupa lo siguiente en un solo mensaje.`;
  }
  return `✅ Vas ${countInWindow} de ${maxInWindow} anuncios recientes. Aún tienes margen, pero espacia las publicaciones.`;
};

/**
 * Reminds admins not to spam: counts how many announcement timestamps fall
 * inside the inclusive window [nowMs - windowMs, nowMs] and flags when that
 * count exceeds maxInWindow, returning accented Spanish advice.
 *
 * Timestamps older than the window start or in the future (after nowMs) are
 * ignored. Options are clamped: windowMs to >= 0 and maxInWindow to a
 * non-negative integer, so malformed inputs cannot produce nonsense limits.
 * Order of timestampsMs never affects the result.
 *
 * Pure and deterministic.
 */
export const checkAnnouncementFrequency = (
  timestampsMs: readonly number[],
  nowMs: number,
  options?: AnnouncementFrequencyOptions,
): AnnouncementFrequencyResult => {
  const windowMs = Math.max(0, options?.windowMs ?? DEFAULT_WINDOW_MS);
  const maxInWindow = Math.max(
    0,
    Math.floor(options?.maxInWindow ?? DEFAULT_MAX_IN_WINDOW),
  );
  const windowStart = nowMs - windowMs;

  let countInWindow = 0;
  for (const t of timestampsMs) {
    if (t >= windowStart && t <= nowMs) {
      countInWindow += 1;
    }
  }

  const tooMany = countInWindow > maxInWindow;
  const advice = buildAdvice(countInWindow, maxInWindow, tooMany);
  return { tooMany, countInWindow, advice };
};
