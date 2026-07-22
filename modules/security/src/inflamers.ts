/**
 * Radar de usuarios "inflamadores": personas que no rompen reglas explicitas
 * pero que empeoran las conversaciones en las que participan. El modulo mide
 * cuantos hilos empeoran (escalan) respecto a los hilos en los que participan.
 */

/** Actividad conversacional de un usuario a puntuar. Pure and deterministic. */
export interface InflamerActivity {
  /** Identificador estable del usuario. */
  readonly userId: number;
  /** Numero de hilos en los que el usuario participo. */
  readonly threadsJoined: number;
  /** Numero de esos hilos que terminaron escalando (empeorando). */
  readonly threadsEscalated: number;
}

/** Opciones de umbral para el radar. Pure and deterministic. */
export interface InflamerOptions {
  /** Minimo de hilos participados para ser evaluable (por defecto 3). */
  readonly minThreads?: number;
  /** Tasa minima de escalado para marcar (por defecto 0.5). */
  readonly minRate?: number;
}

/** Usuario marcado como inflamador con su tasa de escalado. Pure and deterministic. */
export interface InflamerHit {
  /** Identificador del usuario marcado. */
  readonly userId: number;
  /** Proporcion de hilos que escalaron, redondeada a 2 decimales. */
  readonly escalationRate: number;
}

const DEFAULT_MIN_THREADS = 3;
const DEFAULT_MIN_RATE = 0.5;

/** Redondea a 2 decimales de forma estable. Pure and deterministic. */
const roundTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detecta usuarios inflamadores: participantes con al menos `minThreads` hilos
 * y una tasa de escalado (threadsEscalated / threadsJoined) de al menos
 * `minRate`. La tasa se redondea a 2 decimales antes de comparar y devolver.
 * Los usuarios con `threadsJoined` no positivo se descartan (tasa 0). El
 * resultado se ordena por tasa descendente y, en empate, por userId ascendente.
 * Pure and deterministic.
 */
export const detectInflamers = (
  users: readonly InflamerActivity[],
  options?: InflamerOptions,
): readonly InflamerHit[] => {
  const minThreads = options?.minThreads ?? DEFAULT_MIN_THREADS;
  const minRate = options?.minRate ?? DEFAULT_MIN_RATE;

  const hits: InflamerHit[] = [];
  for (const user of users) {
    if (user.threadsJoined < minThreads || user.threadsJoined <= 0) {
      continue;
    }
    const rate = roundTwo(user.threadsEscalated / user.threadsJoined);
    if (rate >= minRate) {
      hits.push({ userId: user.userId, escalationRate: rate });
    }
  }

  return hits.sort((a, b) => {
    if (b.escalationRate !== a.escalationRate) {
      return b.escalationRate - a.escalationRate;
    }
    return a.userId - b.userId;
  });
};
