/**
 * Detector de dogpiling / acoso por repeticion hacia una persona: muchos
 * usuarios DISTINTOS dirigiendose al mismo target en poco tiempo. Logica pura y
 * determinista; recibe `nowMs` y eventos planos y no hace I/O ni consulta reloj.
 */

/** Evento plano: `fromId` escribio a `toId` en el instante epoch `ms`. */
export interface DogpileEvent {
  readonly fromId: string;
  readonly toId: string;
  readonly ms: number;
}

/** Numero minimo de atacantes distintos para considerar que hay dogpiling. */
export const DOGPILE_MIN_ATTACKERS = 3;

/** Resultado del analisis de dogpiling para un target concreto. */
export interface DogpileResult {
  readonly piling: boolean;
  readonly attackers: number;
  readonly reason: string;
}

/**
 * Devuelve los ids UNICOS (primera aparicion) que dentro de la ventana
 * `[nowMs - windowMs, nowMs]` se dirigieron a `targetId`, excluyendo al propio
 * target (auto-mensajes no cuentan). Eventos futuros (`ms > nowMs`) o anteriores
 * a la ventana se descartan. Ventana no positiva => sin atacantes. Puro.
 */
export const dogpileAttackers = (
  targetId: string,
  recent: readonly DogpileEvent[],
  windowMs: number,
  nowMs: number,
): string[] => {
  if (windowMs <= 0) {
    return [];
  }

  const startMs = nowMs - windowMs;
  const seen = new Set<string>();
  const attackers: string[] = [];

  for (const event of recent) {
    if (event.toId !== targetId) {
      continue;
    }
    if (event.fromId === targetId) {
      continue;
    }
    if (event.ms < startMs || event.ms > nowMs) {
      continue;
    }
    if (!seen.has(event.fromId)) {
      seen.add(event.fromId);
      attackers.push(event.fromId);
    }
  }

  return attackers;
};

/**
 * Analiza si `targetId` esta sufriendo dogpiling: hay piling cuando al menos
 * `DOGPILE_MIN_ATTACKERS` usuarios distintos se dirigieron a el dentro de la
 * ventana temporal. `reason` explica el veredicto en espanol-neutro. Puro y
 * determinista: mismos inputs => mismo output.
 */
export const detectDogpiling = (
  targetId: string,
  recent: readonly DogpileEvent[],
  windowMs: number,
  nowMs: number,
): DogpileResult => {
  const attackerIds = dogpileAttackers(targetId, recent, windowMs, nowMs);
  const attackers = attackerIds.length;
  const piling = attackers >= DOGPILE_MIN_ATTACKERS;

  const reason = piling
    ? `${attackers} usuarios distintos se dirigieron al target en la ventana`
    : `solo ${attackers} usuarios distintos: por debajo del umbral de ${DOGPILE_MIN_ATTACKERS}`;

  return { piling, attackers, reason };
};
