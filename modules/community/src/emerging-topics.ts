/**
 * Detector de temas emergentes y muertos para un grupo. A partir de conteos
 * por tema en dos ventanas de tiempo (reciente vs anterior) decide que temas
 * estan despegando y cuales han dejado de mencionarse. Logica pura: recibe
 * conteos planos y no realiza I/O ni depende de reloj/azar.
 */

export interface TopicCount {
  readonly topic: string;
  readonly recent: number;
  readonly previous: number;
}

/**
 * Minimo de menciones recientes que un tema necesita para poder considerarse
 * emergente. Evita que temas con 1-2 menciones disparen falsos positivos
 * (p. ej. `previous` = 0 hace que cualquier `recent` supere el factor).
 */
export const EMERGING_TOPICS_MIN_RECENT = 3;

/**
 * Devuelve los temas emergentes: aquellos cuyo `recent` alcanza al menos
 * `EMERGING_TOPICS_MIN_RECENT` menciones y ademas es mayor o igual que
 * `previous * growthFactor`. Preserva el orden de entrada y no duplica. Un
 * `growthFactor` <= 0 se trata como 0 (solo aplica el minimo). Puro y
 * determinista.
 */
export const detectEmergingTopics = (
  counts: readonly TopicCount[],
  growthFactor: number,
): readonly string[] => {
  const factor = growthFactor > 0 ? growthFactor : 0;
  const emerging: string[] = [];

  for (const count of counts) {
    if (
      count.recent >= EMERGING_TOPICS_MIN_RECENT &&
      count.recent >= count.previous * factor
    ) {
      emerging.push(count.topic);
    }
  }

  return emerging;
};

/**
 * Devuelve los temas muertos: aquellos con `recent` exactamente 0 pero que
 * tenian `previous` > 0 (se mencionaban antes y ya no). Preserva el orden de
 * entrada. Puro y determinista.
 */
export const detectDeadTopics = (
  counts: readonly TopicCount[],
): readonly string[] => {
  const dead: string[] = [];

  for (const count of counts) {
    if (count.recent === 0 && count.previous > 0) {
      dead.push(count.topic);
    }
  }

  return dead;
};
