/**
 * Apelaciones agrupadas por incidente. Cuando el bot detecta un raid y actua en
 * lote, varios usuarios pueden apelar el mismo incidente; agrupar esas
 * apelaciones ayuda a detectar un falso positivo masivo (posible error del bot).
 * Logica pura: recibe items planos y devuelve estructuras inmutables. Sin I/O,
 * red, ni relojes.
 */

/**
 * Una apelacion individual asociada a un incidente. `ms` es el epoch (ms) en que
 * el usuario apelo; lo aportan los callers para mantener este modulo puro.
 */
export interface AppealItem {
  readonly userId: string;
  readonly incidentId: string;
  readonly ms: number;
}

/**
 * Agrupa las apelaciones por incidente devolviendo, para cada incidentId, la
 * lista de userIds unicos que apelaron. El orden de los incidentes y el de los
 * usuarios dentro de cada incidente sigue la primera aparicion en `items`
 * (orden estable). Puro y determinista.
 */
export const groupAppealsByIncident = (
  items: readonly AppealItem[],
): Readonly<Record<string, readonly string[]>> => {
  const order: string[] = [];
  const byIncident = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();

  for (const item of items) {
    let users = byIncident.get(item.incidentId);
    let userSet = seen.get(item.incidentId);

    if (users === undefined || userSet === undefined) {
      users = [];
      userSet = new Set<string>();
      byIncident.set(item.incidentId, users);
      seen.set(item.incidentId, userSet);
      order.push(item.incidentId);
    }

    if (!userSet.has(item.userId)) {
      userSet.add(item.userId);
      users.push(item.userId);
    }
  }

  const result: Record<string, readonly string[]> = {};
  for (const incidentId of order) {
    result[incidentId] = byIncident.get(incidentId) ?? [];
  }

  return result;
};

/**
 * Devuelve los incidentIds cuyo numero de usuarios unicos que apelaron es mayor
 * o igual a `threshold`: candidatos a falso positivo masivo (posible error del
 * bot al detectar un raid). El orden sigue la primera aparicion en `items`.
 * Un `threshold` menor o igual a 0 no tiene sentido operativo: se trata como 1
 * para no marcar incidentes sin apelaciones. Puro y determinista.
 */
export const detectMassFalsePositive = (
  items: readonly AppealItem[],
  threshold: number,
): readonly string[] => {
  const effectiveThreshold = threshold < 1 ? 1 : threshold;
  const grouped = groupAppealsByIncident(items);
  const flagged: string[] = [];

  for (const incidentId of Object.keys(grouped)) {
    const users = grouped[incidentId] ?? [];
    if (users.length >= effectiveThreshold) {
      flagged.push(incidentId);
    }
  }

  return flagged;
};
