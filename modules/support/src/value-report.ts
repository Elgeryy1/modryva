/**
 * Informe de "valor generado" para el owner del grupo: traduce los contadores
 * crudos del periodo (acciones de moderacion, spam bloqueado, tickets cerrados,
 * altas y bajas de miembros) en un texto en espanol y una comparacion contra el
 * periodo anterior. Logica pura y determinista: recibe los contadores por
 * parametro y no hace ninguna I/O, red, ni lee el reloj.
 */

/** Contadores planos de un periodo (por ejemplo un mes). */
export interface ValueStats {
  readonly actionsResolved: number;
  readonly spamBlocked: number;
  readonly ticketsClosed: number;
  readonly newMembers: number;
  readonly membersLost: number;
}

/**
 * Comparacion de una metrica contra su valor previo. `deltaPct` es null cuando
 * no hay base de comparacion (sin periodo previo, o el previo era 0 y por tanto
 * el porcentaje no esta definido).
 */
export interface ValueDelta {
  readonly value: number;
  readonly deltaPct: number | null;
  readonly direction: "up" | "down" | "flat";
}

/** Informe completo: titular, deltas por metrica y texto legible. */
export interface ValueReport {
  readonly headline: string;
  readonly deltas: Record<string, ValueDelta>;
  readonly text: string;
}

/** Etiquetas humanas (espanol-neutro, sin acentos) por clave de metrica. */
const VALUE_METRIC_LABELS: Record<keyof ValueStats, string> = {
  actionsResolved: "Acciones resueltas",
  spamBlocked: "Spam bloqueado",
  ticketsClosed: "Tickets cerrados",
  newMembers: "Nuevos miembros",
  membersLost: "Miembros perdidos",
};

/** Orden estable en el que se recorren las metricas del informe. */
const VALUE_METRIC_ORDER: readonly (keyof ValueStats)[] = [
  "actionsResolved",
  "spamBlocked",
  "ticketsClosed",
  "newMembers",
  "membersLost",
];

/**
 * Calcula la comparacion de un valor actual contra su previo. Sin previo la
 * direccion es "flat" (no hay con que comparar). Con previo 0 el porcentaje es
 * null pero la direccion si distingue si aparecio actividad nueva. Determinista.
 */
export const computeValueDelta = (
  value: number,
  prev: number | undefined,
): ValueDelta => {
  if (prev === undefined) {
    return { value, deltaPct: null, direction: "flat" };
  }

  const direction: ValueDelta["direction"] =
    value > prev ? "up" : value < prev ? "down" : "flat";

  if (prev === 0) {
    return { value, deltaPct: null, direction };
  }

  const deltaPct = Math.round(((value - prev) / prev) * 100);
  return { value, deltaPct, direction };
};

/**
 * Formatea un valor con su variacion respecto al previo, p.ej. "12 (+20%)",
 * "8 (-15%)", "5 (=)". Sin previo devuelve solo el numero; si el previo era 0 y
 * ahora hay actividad, marca "(nuevo)". Determinista.
 */
export const formatValueDelta = (
  value: number,
  prev: number | undefined,
): string => {
  if (prev === undefined) {
    return `${value}`;
  }

  const delta = computeValueDelta(value, prev);

  if (delta.deltaPct === null) {
    return value > 0 ? `${value} (nuevo)` : `${value} (=)`;
  }

  if (delta.direction === "flat") {
    return `${value} (=)`;
  }

  const sign = delta.deltaPct > 0 ? "+" : "";
  return `${value} (${sign}${delta.deltaPct}%)`;
};

/**
 * Construye el informe de valor generado. `prev` es opcional: sin el, los deltas
 * quedan sin porcentaje y el texto solo muestra los totales del periodo. El
 * titular sigue el patron "Modryva resolvio N acciones este mes". Determinista.
 */
export const buildValueReport = (
  current: ValueStats,
  prev?: ValueStats,
): ValueReport => {
  const deltas: Record<string, ValueDelta> = {};
  for (const key of VALUE_METRIC_ORDER) {
    deltas[key] = computeValueDelta(current[key], prev ? prev[key] : undefined);
  }

  const headline = `Modryva resolvio ${current.actionsResolved} acciones este mes`;

  const netMembers = current.newMembers - current.membersLost;
  const netLabel = netMembers > 0 ? `+${netMembers}` : `${netMembers}`;

  const lines = [
    `${headline}.`,
    ...VALUE_METRIC_ORDER.map(
      (key) =>
        `- ${VALUE_METRIC_LABELS[key]}: ${formatValueDelta(
          current[key],
          prev ? prev[key] : undefined,
        )}`,
    ),
    `Balance de miembros: ${netLabel}.`,
  ];

  return { headline, deltas, text: lines.join("\n") };
};
