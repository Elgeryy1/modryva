/**
 * Metricas de tiempo de moderacion. Modulo de logica pura: recibe timestamps
 * (epoch ms) planos y devuelve agregados deterministas. Sin I/O, sin red, sin
 * Date.now(): el llamante aporta cada valor por parametro. Util para paneles de
 * soporte que resumen cuanto tarda el staff en responder y resolver casos.
 */

/**
 * Tiempos de un caso de moderacion en epoch ms. `firstStaffResponseMs` y
 * `resolvedMs` son opcionales: undefined significa "aun sin primera respuesta"
 * o "aun abierto". Los deltas se calculan siempre respecto de `createdMs`.
 */
export interface CaseTiming {
  readonly createdMs: number;
  readonly firstStaffResponseMs?: number;
  readonly resolvedMs?: number;
}

/**
 * Resultado agregado de {@link computeCaseMetrics}. Los promedios y la mediana
 * son null cuando no hay ninguna muestra que los alimente (ignorando los
 * undefined). Los contadores nunca son null.
 */
export interface CaseMetricsSummary {
  readonly avgFirstResponseMs: number | null;
  readonly medianFirstResponseMs: number | null;
  readonly avgResolutionMs: number | null;
  readonly openCount: number;
  readonly resolvedCount: number;
  readonly respondedCount: number;
}

/** Media aritmetica de una lista no vacia; null si esta vacia. */
const average = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
};

/**
 * Mediana con orden estable: ordena una copia de menor a mayor sin alterar la
 * lista original. Con cantidad par promedia los dos valores centrales. Devuelve
 * null si la lista esta vacia.
 */
const stableMedian = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/**
 * Calcula metricas de tiempo sobre una lista de casos. El tiempo de primera
 * respuesta es `firstStaffResponseMs - createdMs` (solo para casos con
 * respuesta); el de resolucion es `resolvedMs - createdMs` (solo para resueltos).
 * Los casos sin el campo correspondiente se ignoran en promedios y mediana, no
 * cuentan como cero. `openCount` son los casos sin `resolvedMs`. Pura y
 * determinista.
 */
export const computeCaseMetrics = (
  cases: readonly CaseTiming[],
): CaseMetricsSummary => {
  const firstResponseDeltas: number[] = [];
  const resolutionDeltas: number[] = [];
  let openCount = 0;
  let resolvedCount = 0;
  let respondedCount = 0;

  for (const item of cases) {
    if (item.firstStaffResponseMs !== undefined) {
      respondedCount += 1;
      firstResponseDeltas.push(item.firstStaffResponseMs - item.createdMs);
    }
    if (item.resolvedMs !== undefined) {
      resolvedCount += 1;
      resolutionDeltas.push(item.resolvedMs - item.createdMs);
    } else {
      openCount += 1;
    }
  }

  return {
    avgFirstResponseMs: average(firstResponseDeltas),
    medianFirstResponseMs: stableMedian(firstResponseDeltas),
    avgResolutionMs: average(resolutionDeltas),
    openCount,
    resolvedCount,
    respondedCount,
  };
};

/**
 * Formatea una duracion en milisegundos como cadena compacta neutral:
 * `"<1m"` por debajo de un minuto (tambien para negativos), `"5m"`, `"2h 3m"`,
 * `"1d 4h"`. Los restos en cero se omiten (`"2h"`, `"1d"`). Pura y determinista.
 */
export const formatCaseDuration = (ms: number): string => {
  if (ms < 60_000) {
    return "<1m";
  }

  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  return `${totalMinutes}m`;
};
