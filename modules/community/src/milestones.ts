/**
 * Celebraciones de hitos reales de miembros del grupo. Logica pura: recibe el
 * conteo antes/despues de un evento (alta de miembro) y decide si se cruzo un
 * hito, mas el texto user-facing para anunciarlo. Sin I/O ni estado.
 */

/**
 * Hitos de miembros que el grupo celebra, en orden ascendente. Solo estos
 * numeros disparan una celebracion.
 */
export const MEMBER_MILESTONES: readonly number[] = [
  100, 500, 1000, 5000, 10000,
];

/**
 * Devuelve el mayor hito estrictamente mayor que `before` y menor o igual que
 * `after` (el hito cruzado al crecer de `before` a `after`), o null si no se
 * cruzo ninguno. Si `after <= before` (sin crecimiento o decrecimiento)
 * siempre devuelve null. Pura y determinista.
 */
export const crossedMilestone = (
  before: number,
  after: number,
): number | null => {
  if (after <= before) {
    return null;
  }

  let crossed: number | null = null;
  for (const milestone of MEMBER_MILESTONES) {
    if (
      milestone > before &&
      milestone <= after &&
      milestone > (crossed ?? -1)
    ) {
      crossed = milestone;
    }
  }

  return crossed;
};

/**
 * Formatea el conteo de miembros con separador de millares (punto, estilo
 * es-ES): 1000 -> "1.000", 10000 -> "10.000". Los conteos negativos se tratan
 * como cero. Pura y determinista.
 */
const formatCount = (members: number): string => {
  const safe = members > 0 ? Math.floor(members) : 0;
  return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/**
 * Construye el anuncio user-facing de un hito de miembros, por ejemplo
 * "🎉 Ya somos 1.000 miembros! Gracias por construir esta comunidad." con
 * acentos correctos. Pura y determinista.
 */
export const formatMilestone = (members: number): string =>
  `🎉 Ya somos ${formatCount(members)} miembros! Gracias por construir esta comunidad.`;
