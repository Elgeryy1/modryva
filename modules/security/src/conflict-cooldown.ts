/**
 * Enfriamiento social entre dos usuarios tras un conflicto. Cuando dos usuarios
 * discuten, un moderador puede imponer un periodo durante el cual no pueden
 * mencionarse el uno al otro. Este modulo es logica pura: recibe `nowMs` y
 * datos planos y no toca reloj, red ni almacenamiento.
 */

/**
 * Un par ordenado-independiente de usuarios en enfriamiento. `aId` y `bId` son
 * identificadores de Telegram serializados como texto. El orden no importa: el
 * par {a, b} es el mismo que {b, a}.
 */
export interface ConflictPair {
  readonly aId: string;
  readonly bId: string;
}

/**
 * Calcula el instante (epoch ms) hasta el cual el enfriamiento sigue activo,
 * partiendo de `nowMs` y una duracion en ms. Duraciones negativas se tratan
 * como cero, de modo que el enfriamiento nunca queda en el pasado respecto a
 * `nowMs`. Puro y determinista.
 */
export const startConflictCooldown = (
  nowMs: number,
  durationMs: number,
): number => nowMs + (durationMs > 0 ? durationMs : 0);

/**
 * True cuando una mencion de `fromId` hacia `toId` debe bloquearse por el
 * enfriamiento del par en conflicto. Se bloquea solo si:
 *  - el enfriamiento sigue activo (`nowMs` < `cooldownUntilMs`), y
 *  - la mencion cruza exactamente a los dos usuarios del par (from y to son a y
 *    b en cualquier orden).
 * Una auto-mencion (`fromId` === `toId`) nunca se bloquea, igual que cualquier
 * mencion que involucre a un tercero. Puro y determinista.
 */
export const shouldBlockMention = (
  pair: ConflictPair,
  cooldownUntilMs: number,
  nowMs: number,
  fromId: string,
  toId: string,
): boolean => {
  if (nowMs >= cooldownUntilMs) {
    return false;
  }
  if (fromId === toId) {
    return false;
  }
  const crossesForward = fromId === pair.aId && toId === pair.bId;
  const crossesBackward = fromId === pair.bId && toId === pair.aId;
  return crossesForward || crossesBackward;
};
