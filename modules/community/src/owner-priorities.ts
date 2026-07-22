/**
 * Panel de prioridades del dia del owner. Toma senales planas del estado del
 * grupo (colas de moderacion, reportes, solicitudes pendientes...) y produce un
 * ranking determinista para que el dueno sepa que atender primero. Logica pura:
 * sin I/O, sin red, sin reloj; recibe todo por parametro.
 */

/** Nivel de gravedad de una senal, de menor a mayor urgencia. */
export type OwnerSeverity = "info" | "warn" | "critical";

/**
 * Una senal cruda del panel del owner. `kind` identifica el tipo (p. ej.
 * "reportes", "solicitudes"), `count` es cuantos elementos agrupa y `severity`
 * su gravedad.
 */
export interface OwnerSignal {
  readonly kind: string;
  readonly count: number;
  readonly severity: OwnerSeverity;
}

/** Una entrada del ranking: el tipo de senal y su peso calculado. */
export interface OwnerPriority {
  readonly kind: string;
  readonly weight: number;
}

/** Peso base por gravedad; el peso final es este factor por el count. */
const SEVERITY_WEIGHT: Readonly<Record<OwnerSeverity, number>> = {
  info: 1,
  warn: 3,
  critical: 10,
};

/** Emoji mostrado en el brief segun la gravedad de la senal. */
const SEVERITY_ICON: Readonly<Record<OwnerSeverity, string>> = {
  info: "🔵",
  warn: "🟠",
  critical: "🔴",
};

/**
 * Calcula el peso de una senal: factor de gravedad por el numero de elementos.
 * Un count negativo se trata como cero para no restar prioridad. Puro.
 */
export const ownerSignalWeight = (signal: OwnerSignal): number => {
  const count = signal.count > 0 ? signal.count : 0;
  return SEVERITY_WEIGHT[signal.severity] * count;
};

/**
 * Ordena las senales por peso (gravedad*count) de mayor a menor, de forma
 * estable: ante pesos iguales conserva el orden de entrada. Devuelve solo el
 * tipo y el peso. Puro y determinista.
 */
export const rankOwnerPriorities = (
  signals: readonly OwnerSignal[],
): readonly OwnerPriority[] => {
  const decorated = signals.map((signal, index) => ({
    kind: signal.kind,
    weight: ownerSignalWeight(signal),
    index,
  }));

  decorated.sort((a, b) =>
    b.weight !== a.weight ? b.weight - a.weight : a.index - b.index,
  );

  return decorated.map(({ kind, weight }) => ({ kind, weight }));
};

/**
 * Construye el resumen legible del dia para el owner con las 3 prioridades mas
 * altas. Cadena user-facing con acentos correctos. Sin senales devuelve un
 * mensaje de "todo tranquilo". Puro y determinista.
 */
export const formatOwnerBrief = (signals: readonly OwnerSignal[]): string => {
  const ranked = rankOwnerPriorities(signals);
  const bySeverity = new Map(signals.map((s) => [s.kind, s.severity] as const));

  const top = ranked.slice(0, 3);
  if (top.length === 0 || top.every((p) => p.weight === 0)) {
    return "✅ Todo tranquilo: no hay prioridades pendientes hoy.";
  }

  const lines = top
    .filter((priority) => priority.weight > 0)
    .map((priority, position) => {
      const severity = bySeverity.get(priority.kind) ?? "info";
      const icon = SEVERITY_ICON[severity];
      return `${position + 1}. ${icon} ${priority.kind} (peso ${priority.weight})`;
    });

  return ["📋 Prioridades del día:", ...lines].join("\n");
};
