/**
 * Dock/favoritos personalizable por admin: el panel del bot muestra una barra
 * de accesos rapidos (el "dock") cuyo contenido y orden puede reordenar cada
 * admin. Este modulo es logica pura: recibe listas planas de ids y devuelve la
 * seleccion resuelta. Sin I/O, sin Prisma, sin red, sin Date/Math.
 */

/**
 * Dock por defecto que se muestra cuando el admin no ha personalizado nada.
 * El orden importa: es el orden en que aparecen los accesos en la barra.
 */
export const DEFAULT_DOCK: readonly string[] = [
  "hoy",
  "inbox",
  "usuarios",
  "juegos",
  "staff",
];

/**
 * Resuelve el dock final a partir de los `overrides` elegidos por el admin y
 * la lista `allowed` de ids permitidos (los accesos a los que ese admin tiene
 * derecho). Reglas:
 * - Respeta el orden del admin (`overrides`).
 * - Filtra ids que no esten en `allowed`.
 * - Elimina duplicados conservando la primera aparicion.
 * - Si `overrides` no deja ningun id valido, cae al DEFAULT_DOCK filtrado por
 *   `allowed` (asi el dock nunca queda vacio si hay accesos permitidos).
 * Pura y determinista.
 */
export const resolveDock = (
  overrides: readonly string[],
  allowed: readonly string[],
): readonly string[] => {
  const allowedSet = new Set(allowed);

  const pick = (source: readonly string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of source) {
      if (allowedSet.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };

  const resolved = pick(overrides);
  return resolved.length > 0 ? resolved : pick(DEFAULT_DOCK);
};

/**
 * Alterna un favorito: si `id` ya esta en `favs` lo quita (conservando el
 * orden del resto); si no esta y aun no se alcanzo `max`, lo agrega al final.
 * Cuando ya se alcanzo `max` y el `id` no estaba presente, devuelve `favs`
 * sin cambios (misma referencia). `max` menor que 1 se trata como 0, por lo
 * que nunca se agregan favoritos. Pura y determinista.
 */
export const toggleFavorite = (
  favs: readonly string[],
  id: string,
  max: number,
): readonly string[] => {
  if (favs.includes(id)) {
    return favs.filter((fav) => fav !== id);
  }

  const cap = max < 0 ? 0 : max;
  if (favs.length >= cap) {
    return favs;
  }

  return [...favs, id];
};
