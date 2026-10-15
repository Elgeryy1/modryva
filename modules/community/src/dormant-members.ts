/**
 * A member candidate to evaluate for dormancy. lastActiveMs is the epoch
 * timestamp in milliseconds of the member's last observed activity.
 */
export interface DormantMemberInput {
  /**
   * El id de Telegram, como cadena.
   *
   * Era `number`, y eso obligaba a sus dos llamantes a hacer
   * `Number(telegramUserId)` sobre un `bigint` y despues `.toString()` para
   * volver a buscar el perfil. Un id es un identificador, no una cantidad: no
   * se suma ni se compara por tamaño, y pasarlo por `number` solo abre la
   * puerta a perder precision el dia que Telegram reparta ids por encima de
   * 2^53. Hoy tienen 10 digitos y el limite son 16, asi que no se ha roto
   * nada — pero el rodeo no compraba nada a cambio.
   */
  readonly userId: string;
  readonly lastActiveMs: number;
}

/**
 * A member detected as dormant, together with how long it has been idle
 * in milliseconds relative to the provided nowMs.
 */
export interface DormantMember {
  readonly userId: string;
  readonly idleMs: number;
}

/**
 * Default dormancy window: a member idle for at least 14 days is considered
 * dormant. Expressed in milliseconds. Pure and deterministic.
 */
export const DORMANT_DEFAULT_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Detects dormant members eligible for a soft reactivation nudge. A member is
 * dormant when its idle time (nowMs minus lastActiveMs) is at least
 * dormantAfterMs (default DORMANT_DEFAULT_AFTER_MS). Members active in the
 * future (negative idle) are never dormant. Results are sorted by idleMs
 * descending, breaking ties by userId ascending, so the output order is
 * stable regardless of input order. The input array is never mutated.
 * Pure and deterministic.
 */
export const detectDormantMembers = (
  members: readonly DormantMemberInput[],
  nowMs: number,
  options?: { readonly dormantAfterMs?: number },
): readonly DormantMember[] => {
  const threshold = options?.dormantAfterMs ?? DORMANT_DEFAULT_AFTER_MS;
  const dormant: DormantMember[] = [];
  for (const member of members) {
    const idleMs = nowMs - member.lastActiveMs;
    if (idleMs >= threshold) {
      dormant.push({ userId: member.userId, idleMs });
    }
  }
  dormant.sort((a, b) => {
    if (b.idleMs !== a.idleMs) {
      return b.idleMs - a.idleMs;
    }
    // Orden numerico sobre cadenas de digitos: primero por longitud y luego
    // alfabetico. Comparar solo como texto pondria "10" antes que "9", que no
    // es el orden que promete la documentacion de arriba.
    //
    // Se hace asi y no con Number() porque un id es un identificador: la
    // comparacion solo existe para que el orden sea estable, no porque el
    // numero signifique nada.
    if (a.userId.length !== b.userId.length) {
      return a.userId.length - b.userId.length;
    }
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
  return dormant;
};
