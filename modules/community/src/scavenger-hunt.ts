/**
 * Busqueda del tesoro por pistas: logica pura para validar respuestas a pistas
 * y avanzar por los pasos de una caza. Sin I/O, sin red, sin reloj: recibe el
 * estado como dato plano y devuelve nuevos valores. Determinista.
 */

/**
 * Estado de una caza en curso. `stepIndex` es el indice del paso actual
 * (0-based); `total` es el numero total de pasos. Una caza esta terminada
 * cuando `stepIndex >= total`.
 */
export interface HuntState {
  readonly stepIndex: number;
  readonly total: number;
}

/**
 * Normaliza una cadena para comparar pistas: quita acentos/diacriticos, recorta
 * espacios de los extremos, colapsa espacios internos y pasa a minusculas. Pura.
 */
const normalizeHuntText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * True cuando la respuesta del jugador coincide con la esperada tras normalizar
 * ambas (sin acentos, sin espacios sobrantes, minusculas). Pura y determinista.
 */
export const checkHuntClue = (answer: string, expected: string): boolean =>
  normalizeHuntText(answer) === normalizeHuntText(expected);

/**
 * Avanza la caza un paso. El nuevo `stepIndex` nunca supera `total` (se satura).
 * `finished` es true cuando, tras avanzar, no quedan pasos por resolver
 * (nuevo indice >= total). Con `total <= 0` la caza esta terminada de entrada.
 * No muta el estado recibido. Pura y determinista.
 */
export const advanceHunt = (
  state: HuntState,
): { readonly state: HuntState; readonly finished: boolean } => {
  const capped = state.total > 0 ? state.total : 0;
  const current = state.stepIndex < 0 ? 0 : state.stepIndex;
  const nextIndex = current + 1 > capped ? capped : current + 1;
  return {
    state: { stepIndex: nextIndex, total: capped },
    finished: nextIndex >= capped,
  };
};

/**
 * Progreso de la caza como fraccion entre 0 y 1: `stepIndex / total`, saturado
 * al rango [0, 1]. Con `total <= 0` devuelve 0. Pura y determinista.
 */
export const huntProgress = (state: HuntState): number => {
  if (state.total <= 0) {
    return 0;
  }
  const done = state.stepIndex < 0 ? 0 : state.stepIndex;
  const ratio = done / state.total;
  return ratio > 1 ? 1 : ratio;
};
