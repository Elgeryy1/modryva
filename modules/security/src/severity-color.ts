/**
 * Severity color for visual moderation, ordered from least to most severe:
 * "verde" (green) < "amarillo" (yellow) < "naranja" (orange) < "rojo" (red).
 */
export type SeverityColor = "verde" | "amarillo" | "naranja" | "rojo";

/**
 * Classification of a severity score: its color band, a short recommended
 * moderation action, and a visual label. All user-facing text is Spanish.
 */
export interface SeverityClassification {
  readonly color: SeverityColor;
  readonly action: string;
  readonly label: string;
}

/**
 * Canonical classification for every color. Action and label are user-facing
 * Spanish strings; the emoji encodes the color for a quick visual read.
 */
const CLASSIFICATIONS: Record<SeverityColor, SeverityClassification> = {
  verde: {
    color: "verde",
    action: "Observar sin intervenir",
    label: "🟢 Riesgo bajo",
  },
  amarillo: {
    color: "amarillo",
    action: "Avisar al usuario",
    label: "🟡 Riesgo moderado",
  },
  naranja: {
    color: "naranja",
    action: "Silenciar temporalmente",
    label: "🟠 Riesgo alto",
  },
  rojo: {
    color: "rojo",
    action: "Expulsar del grupo",
    label: "🔴 Riesgo crítico",
  },
};

/**
 * Inclusive lower bound of each band, highest first, so the first match wins.
 * Bands: 75-100 rojo, 50-74 naranja, 25-49 amarillo, 0-24 verde.
 */
const SEVERITY_BANDS: readonly (readonly [number, SeverityColor])[] = [
  [75, "rojo"],
  [50, "naranja"],
  [25, "amarillo"],
  [0, "verde"],
];

/**
 * Clamps a raw score into the 0..100 range. Non-finite values (NaN, Infinity)
 * are treated as 0, the lowest severity. Pure and deterministic.
 */
const clampScore = (score: number): number => {
  if (!Number.isFinite(score)) {
    return 0;
  }
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
};

/**
 * Classifies a moderation severity score (0..100) into a color band with a
 * recommended action and visual label. The score is clamped to 0..100 first;
 * non-finite scores map to "verde". Returns a fresh object on each call.
 * Pure and deterministic.
 */
export const classifySeverityColor = (
  score: number,
): SeverityClassification => {
  const clamped = clampScore(score);
  for (const [min, color] of SEVERITY_BANDS) {
    if (clamped >= min) {
      return { ...CLASSIFICATIONS[color] };
    }
  }
  return { ...CLASSIFICATIONS.verde };
};
