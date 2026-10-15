/**
 * Deteccion de miembros fantasma: usuarios que entran a un grupo y nunca
 * interactuan. Logica pura y determinista; no hace I/O ni consulta relojes.
 * Los tiempos llegan como epoch en milisegundos (nowMs, joinedMs, lastSeenMs)
 * para que el llamador controle el reloj.
 */

/**
 * Actividad plana de un miembro. `messages` es el total de mensajes enviados;
 * `lastSeenMs` es el epoch (ms) del ultimo mensaje observado y es opcional
 * (ausente cuando el miembro nunca ha escrito).
 */
export interface MemberActivity {
  readonly userId: string;
  readonly joinedMs: number;
  readonly messages: number;
  readonly lastSeenMs?: number;
}

/**
 * Devuelve los userId de los miembros fantasma: unidos hace mas de `graceMs`
 * (es decir `nowMs - joinedMs > graceMs`) y con exactamente 0 mensajes.
 * Preserva el orden de `members` y no incluye duplicados adicionales (respeta
 * lo que venga en la entrada). Pura y determinista.
 */
export const findGhostMembers = (
  members: readonly MemberActivity[],
  nowMs: number,
  graceMs: number,
): readonly string[] => {
  const ghosts: string[] = [];
  for (const member of members) {
    if (member.messages <= 0 && nowMs - member.joinedMs > graceMs) {
      ghosts.push(member.userId);
    }
  }
  return ghosts;
};

/**
 * Calcula la mediana del tiempo (ms) transcurrido desde que un miembro se unio
 * hasta su primer mensaje, aproximado por `lastSeenMs - joinedMs`. Solo cuentan
 * miembros que ya escribieron (`messages > 0`), con `lastSeenMs` definido y una
 * demora no negativa. Devuelve null cuando no hay ninguna muestra valida. Con
 * un numero par de muestras promedia las dos centrales. Pura y determinista.
 */
export const silenceCurveMs = (
  members: readonly MemberActivity[],
): number | null => {
  const delays: number[] = [];
  for (const member of members) {
    if (member.messages <= 0) {
      continue;
    }
    const lastSeen = member.lastSeenMs;
    if (lastSeen === undefined) {
      continue;
    }
    const delay = lastSeen - member.joinedMs;
    if (delay >= 0) {
      delays.push(delay);
    }
  }

  if (delays.length === 0) {
    return null;
  }

  const sorted = [...delays].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }

  const lower = sorted[mid - 1] ?? 0;
  const upper = sorted[mid] ?? 0;
  return (lower + upper) / 2;
};
