/**
 * Hype level buckets for pre-launch community activity, ordered from
 * coldest to hottest.
 * Pure and deterministic.
 */
export type HypeMeterLevel = "frio" | "templado" | "caliente" | "ardiendo";

/**
 * Input for the hype meter: baseline and current message rates measured
 * in messages per hour.
 * Pure and deterministic.
 */
export interface HypeMeterInput {
  readonly baselinePerHour: number;
  readonly currentPerHour: number;
}

/**
 * Result of measuring pre-launch hype: the activity ratio (current vs
 * baseline, rounded to 2 decimals) and its discrete level.
 * Pure and deterministic.
 */
export interface HypeMeterReading {
  readonly ratio: number;
  readonly level: HypeMeterLevel;
}

/** Rounds a finite number to 2 decimals. Returns 0 for non-finite input. */
const roundTo2 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

/** Clamps a number to be finite and non-negative. */
const sanitizeRate = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

/** Maps an activity ratio to a discrete hype level. */
const levelForRatio = (ratio: number): HypeMeterLevel => {
  if (ratio >= 4) {
    return "ardiendo";
  }
  if (ratio >= 2) {
    return "caliente";
  }
  if (ratio >= 1) {
    return "templado";
  }
  return "frio";
};

/**
 * Measures pre-launch hype by comparing the current message rate against a
 * baseline rate. The ratio is current/baseline rounded to 2 decimals; the
 * level is derived from the rounded ratio. Negative or non-finite rates are
 * treated as 0, and a baseline of 0 yields a cold reading (ratio 0).
 * Pure and deterministic.
 */
export const computeHypeLevel = (input: HypeMeterInput): HypeMeterReading => {
  const baseline = sanitizeRate(input.baselinePerHour);
  const current = sanitizeRate(input.currentPerHour);
  if (baseline <= 0) {
    return { ratio: 0, level: "frio" };
  }
  const ratio = roundTo2(current / baseline);
  return { ratio, level: levelForRatio(ratio) };
};

/**
 * Renders a short user-facing Spanish description of a hype level, with an
 * emoji suited to a Telegram community launch.
 * Pure and deterministic.
 */
export const describeHypeLevel = (level: HypeMeterLevel): string => {
  switch (level) {
    case "ardiendo":
      return "🚀 Ardiendo: ¡la comunidad está desbordada de expectación!";
    case "caliente":
      return "🔥 Caliente: la expectación sube con fuerza antes del lanzamiento.";
    case "templado":
      return "🌤️ Templado: hay algo más de movimiento de lo habitual.";
    case "frio":
      return "❄️ Frío: la actividad sigue por debajo de lo normal.";
  }
};
