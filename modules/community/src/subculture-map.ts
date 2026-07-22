/**
 * Mapa de subculturas internas: agrupa usuarios por intereses (tags)
 * compartidos. Logica pura y determinista: recibe solo datos planos, no hace
 * I/O ni depende de reloj/azar. Sirve para descubrir grupos afines dentro de
 * una comunidad a partir de los tags que cada usuario declara.
 */

/** Un usuario con la lista de tags (intereses) que declara. */
export interface TaggedUser {
  readonly userId: string;
  readonly tags: readonly string[];
}

/** Un grupo de usuarios que comparten un mismo tag. */
export interface Subculture {
  readonly tag: string;
  readonly members: readonly string[];
}

/**
 * Agrupa a los usuarios por cada tag comun y devuelve una subcultura por tag.
 *
 * Reglas:
 * - Un usuario cuenta una sola vez por tag, aunque repita el tag en su lista o
 *   aunque su userId aparezca duplicado en `users`.
 * - `members` conserva el orden de primera aparicion del usuario en `users`.
 * - Solo se incluyen tags con al menos `minShared` miembros (con `minShared`
 *   <= 0 no se filtra nada; con 1 basta un miembro).
 * - El resultado se ordena por tamano de `members` descendente; los empates se
 *   desempatan por `tag` ascendente para ser deterministico.
 *
 * Puro y deterministico.
 */
export const clusterSubcultures = (
  users: readonly TaggedUser[],
  minShared: number,
): readonly Subculture[] => {
  const order: string[] = [];
  const membersByTag = new Map<string, string[]>();
  const seenByTag = new Map<string, Set<string>>();

  for (const user of users) {
    const userId = user.userId;
    for (const tag of user.tags) {
      const existingMembers = membersByTag.get(tag);
      if (existingMembers === undefined) {
        order.push(tag);
        membersByTag.set(tag, [userId]);
        seenByTag.set(tag, new Set<string>([userId]));
        continue;
      }
      const seen = seenByTag.get(tag) ?? new Set<string>();
      if (!seen.has(userId)) {
        seen.add(userId);
        existingMembers.push(userId);
      }
    }
  }

  const clusters: Subculture[] = [];
  for (const tag of order) {
    const members = membersByTag.get(tag) ?? [];
    if (members.length >= minShared) {
      clusters.push({ tag, members });
    }
  }

  clusters.sort((a, b) => {
    if (a.members.length !== b.members.length) {
      return b.members.length - a.members.length;
    }
    return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
  });

  return clusters;
};
