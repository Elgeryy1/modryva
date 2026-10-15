/**
 * Consistencia de criterio entre admins. Detecta cuando un mismo tipo de caso
 * se resuelve con acciones distintas (criterio divergente) y mide la dureza
 * relativa de cada admin comparada con el resto del equipo. Logica pura y
 * determinista: recibe decisiones planas, sin I/O ni estado ambiente.
 */

/** Una decision de moderacion tomada por un admin sobre un tipo de caso. */
export interface AdminDecision {
  readonly adminId: string;
  readonly caseKind: string;
  readonly action: string;
}

/** Un tipo de caso resuelto con mas de una accion distinta. */
export interface ConsistencyDivergence {
  readonly caseKind: string;
  readonly actions: readonly string[];
}

/**
 * Peso de severidad por accion conocida (0 = nada, mayor = mas duro). Las
 * acciones desconocidas usan CONSISTENCY_DEFAULT_SEVERITY. Las claves se
 * comparan en minusculas.
 */
const ACTION_SEVERITY: ReadonlyMap<string, number> = new Map([
  ["none", 0],
  ["ignore", 0],
  ["nada", 0],
  ["ignorar", 0],
  ["warn", 1],
  ["aviso", 1],
  ["advertencia", 1],
  ["delete", 2],
  ["borrar", 2],
  ["mute", 3],
  ["silenciar", 3],
  ["kick", 4],
  ["expulsar", 4],
  ["tempban", 5],
  ["ban", 6],
  ["banear", 6],
]);

/** Severidad asumida para una accion no reconocida. */
export const CONSISTENCY_DEFAULT_SEVERITY = 2;

/**
 * Devuelve el peso de severidad (>= 0) de una accion. Acciones desconocidas
 * devuelven CONSISTENCY_DEFAULT_SEVERITY. Pura y determinista.
 */
export const consistencyActionSeverity = (action: string): number =>
  ACTION_SEVERITY.get(action.trim().toLowerCase()) ??
  CONSISTENCY_DEFAULT_SEVERITY;

/**
 * Agrupa las decisiones por tipo de caso y devuelve solo aquellos que se
 * resolvieron con mas de una accion distinta. Preserva el orden de primera
 * aparicion tanto de los caseKind como de las acciones dentro de cada uno.
 * Pura y determinista.
 */
export const detectInconsistency = (
  decisions: readonly AdminDecision[],
): readonly ConsistencyDivergence[] => {
  const order: string[] = [];
  const byKind = new Map<string, string[]>();

  for (const decision of decisions) {
    const existing = byKind.get(decision.caseKind);
    if (existing === undefined) {
      order.push(decision.caseKind);
      byKind.set(decision.caseKind, [decision.action]);
      continue;
    }
    if (!existing.includes(decision.action)) {
      existing.push(decision.action);
    }
  }

  const result: ConsistencyDivergence[] = [];
  for (const caseKind of order) {
    const actions = byKind.get(caseKind) ?? [];
    if (actions.length > 1) {
      result.push({ caseKind, actions: [...actions] });
    }
  }
  return result;
};

/**
 * Dureza relativa (0..1) de un admin comparada con el resto del equipo, segun
 * la severidad media de sus acciones. 0 = el admin mas blando; 1 = el mas duro.
 * Con un solo admin (o todos con la misma media) devuelve 0.5 (neutro). Si el
 * admin no tiene decisiones devuelve 0. Pura y determinista.
 */
export const adminSeverity = (
  decisions: readonly AdminDecision[],
  adminId: string,
): number => {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const decision of decisions) {
    const severity = consistencyActionSeverity(decision.action);
    sums.set(decision.adminId, (sums.get(decision.adminId) ?? 0) + severity);
    counts.set(decision.adminId, (counts.get(decision.adminId) ?? 0) + 1);
  }

  const targetCount = counts.get(adminId) ?? 0;
  if (targetCount === 0) {
    return 0;
  }

  const average = (id: string): number => {
    const count = counts.get(id) ?? 0;
    return count === 0 ? 0 : (sums.get(id) ?? 0) / count;
  };

  const targetAverage = average(adminId);

  let min = targetAverage;
  let max = targetAverage;
  for (const id of counts.keys()) {
    const avg = average(id);
    if (avg < min) {
      min = avg;
    }
    if (avg > max) {
      max = avg;
    }
  }

  if (max === min) {
    return 0.5;
  }
  return (targetAverage - min) / (max - min);
};
