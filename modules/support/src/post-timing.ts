/**
 * Sugerencia de hora optima de publicacion segun un heatmap de actividad de 24
 * horas (indice 0..23 -> actividad relativa de esa hora). Logica pura y
 * determinista: no hace I/O, ni red, ni usa Date.now()/Math.random(); toda la
 * entrada llega como arrays planos. Seguro ante heatmaps vacios o planos.
 */

/** Numero de horas en un heatmap diario completo. */
export const POST_TIMING_HOURS = 24;

/**
 * Sugerencia devuelta por suggestPostHour: la hora (0..23) de mayor actividad y
 * una confianza 0..1 que mide cuanto destaca esa hora sobre el resto. Con
 * heatmap vacio o completamente plano la confianza es 0.
 */
export interface PostHourSuggestion {
  readonly hour: number;
  readonly confidence: number;
}

/**
 * Normaliza un heatmap a exactamente 24 cubos no negativos y finitos. Los
 * valores negativos, NaN o infinitos se tratan como 0; las entradas ausentes
 * (heatmap corto) se rellenan con 0 y las sobrantes se ignoran.
 */
const normalizeHeatmap = (heatmap: readonly number[]): number[] => {
  const buckets: number[] = [];
  for (let hour = 0; hour < POST_TIMING_HOURS; hour += 1) {
    const raw = heatmap[hour] ?? 0;
    buckets.push(Number.isFinite(raw) && raw > 0 ? raw : 0);
  }
  return buckets;
};

/** Suma total de actividad de un heatmap ya normalizado. */
const totalActivity = (buckets: readonly number[]): number => {
  let total = 0;
  for (const value of buckets) {
    total += value;
  }
  return total;
};

/**
 * Sugiere la hora (0..23) de mayor actividad del heatmap. En caso de empate
 * gana la hora mas temprana. La confianza es la fraccion de actividad que se
 * concentra por encima de la media (0 cuando el heatmap esta vacio o es plano,
 * 1 cuando toda la actividad cae en una sola hora). Pura y determinista.
 */
export const suggestPostHour = (
  heatmap: readonly number[],
): PostHourSuggestion => {
  const buckets = normalizeHeatmap(heatmap);
  const total = totalActivity(buckets);

  if (total <= 0) {
    return { hour: 0, confidence: 0 };
  }

  let bestHour = 0;
  let bestValue = buckets[0] ?? 0;
  for (let hour = 1; hour < POST_TIMING_HOURS; hour += 1) {
    const value = buckets[hour] ?? 0;
    if (value > bestValue) {
      bestValue = value;
      bestHour = hour;
    }
  }

  const mean = total / POST_TIMING_HOURS;
  let aboveMean = 0;
  for (const value of buckets) {
    if (value > mean) {
      aboveMean += value - mean;
    }
  }

  // La actividad maxima que puede quedar por encima de la media es total-mean
  // (todo concentrado en una hora), de modo que el ratio cae en 0..1.
  const maxAbove = total - mean;
  const confidence = maxAbove > 0 ? aboveMean / maxAbove : 0;

  return { hour: bestHour, confidence };
};

/** Umbral: una hora es "buena" si iguala o supera este multiplo de la media. */
export const POST_TIMING_GOOD_RATIO = 1;

/**
 * True cuando `hour` (0..23) es un buen momento para publicar: su actividad
 * iguala o supera la media del heatmap. Devuelve false para horas fuera de
 * rango, no enteras, o cuando el heatmap esta vacio/plano (no hay senal). Pura
 * y determinista.
 */
export const isGoodPostTime = (
  heatmap: readonly number[],
  hour: number,
): boolean => {
  if (!Number.isInteger(hour) || hour < 0 || hour >= POST_TIMING_HOURS) {
    return false;
  }

  const buckets = normalizeHeatmap(heatmap);
  const total = totalActivity(buckets);

  if (total <= 0) {
    return false;
  }

  const mean = total / POST_TIMING_HOURS;
  const value = buckets[hour] ?? 0;

  // Heatmap plano: ninguna hora destaca, asi que ninguna es "buena".
  const isFlat = buckets.every((v) => v === value);
  if (isFlat) {
    return false;
  }

  return value >= mean * POST_TIMING_GOOD_RATIO;
};
