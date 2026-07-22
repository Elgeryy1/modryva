/**
 * Tiempo hasta resolver conflictos o casos. Modulo de logica pura: recibe pares
 * de timestamps (epoch ms) planos y devuelve agregados deterministas sobre las
 * duraciones de resolucion. Sin I/O, sin red, sin Date.now(): el llamante aporta
 * cada valor por parametro. Util para paneles de soporte y moderacion que
 * resumen cuanto se tarda en cerrar un caso.
 */

/**
 * Un caso con sus marcas de tiempo en epoch ms. `resolvedMs` es number cuando el
 * caso ya se resolvio o undefined mientras sigue abierto. Se declara como
 * `number | undefined` (no opcional) para respetar exactOptionalPropertyTypes:
 * el campo siempre esta presente y el llamante decide su valor.
 */
export interface ResolutionCase {
  readonly openedMs: number;
  readonly resolvedMs: number | undefined;
}

/**
 * Resultado agregado de {@link computeResolutionStats}. `resolvedCount` son los
 * casos con duracion valida; `openCount` los que siguen abiertos. `medianMs` y
 * `p90Ms` valen 0 cuando no hay ninguna duracion valida.
 */
export interface ResolutionStats {
  readonly resolvedCount: number;
  readonly openCount: number;
  readonly medianMs: number;
  readonly p90Ms: number;
}

/**
 * Mediana de una lista YA ordenada de menor a mayor. Con cantidad impar devuelve
 * el elemento central; con cantidad par promedia los dos centrales. Devuelve 0
 * si la lista esta vacia.
 */
const medianOfSorted = (sorted: readonly number[]): number => {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const lower = sorted[mid - 1] ?? 0;
  const upper = sorted[mid] ?? 0;
  return (lower + upper) / 2;
};

/**
 * Percentil por rango mas cercano (nearest-rank) sobre una lista YA ordenada.
 * El rango es ceil(percentile/100 * n), acotado al intervalo [1, n]. Devuelve 0
 * si la lista esta vacia. `percentile` se espera en el rango 0..100.
 */
const nearestRankPercentile = (
  sorted: readonly number[],
  percentile: number,
): number => {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const rawRank = Math.ceil((percentile / 100) * n);
  const rank = Math.min(Math.max(rawRank, 1), n);
  return sorted[rank - 1] ?? 0;
};

/**
 * Calcula estadisticas de tiempo de resolucion sobre una lista de casos. La
 * duracion de un caso es `resolvedMs - openedMs` y solo se considera valida
 * cuando `resolvedMs` esta definido y es mayor o igual que `openedMs`.
 *
 * - `resolvedCount`: casos con duracion valida.
 * - `openCount`: casos con `resolvedMs === undefined` (aun abiertos).
 * - Los casos resueltos con `resolvedMs < openedMs` se descartan por datos
 *   inconsistentes: no cuentan ni como resueltos ni como abiertos.
 * - `medianMs` y `p90Ms` (nearest-rank) se calculan sobre las duraciones
 *   ordenadas de menor a mayor; valen 0 cuando no hay duraciones validas.
 *
 * El orden de entrada no altera el resultado (se ordena una copia). No muta la
 * lista recibida. Pura y determinista.
 */
export const computeResolutionStats = (
  cases: readonly ResolutionCase[],
): ResolutionStats => {
  const durations: number[] = [];
  let openCount = 0;

  for (const item of cases) {
    if (item.resolvedMs === undefined) {
      openCount += 1;
      continue;
    }
    if (item.resolvedMs >= item.openedMs) {
      durations.push(item.resolvedMs - item.openedMs);
    }
  }

  const sorted = [...durations].sort((a, b) => a - b);

  return {
    resolvedCount: sorted.length,
    openCount,
    medianMs: medianOfSorted(sorted),
    p90Ms: nearestRankPercentile(sorted, 90),
  };
};
