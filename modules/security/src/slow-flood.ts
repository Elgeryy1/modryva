/**
 * Deteccion de flood lento: spam gradual que reparte muchos mensajes espaciados
 * dentro de una ventana LARGA, sin llegar nunca al pico que dispara el antiflood
 * normal (que mira rafagas en ventanas cortas). Alimenta el motor de senales
 * devolviendo tambien la forma comun { key, weight, present, detail? } sin
 * depender de signals.ts. Todo es logica pura y determinista: no hace I/O ni usa
 * Date.now()/Math.random(); recibe nowMs y los tiempos de mensaje como datos
 * planos.
 */

/** Resultado del detector de flood lento. */
export interface SlowFloodResult {
  readonly suspicious: boolean;
  readonly count: number;
  readonly reason: string;
}

/** Senal en la forma comun del motor. `detail` es opcional y diagnostico. */
export interface SlowFloodSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Limite blando minimo efectivo: por debajo de 1 no tiene sentido detectar. */
export const SLOW_FLOOD_MIN_SOFT_LIMIT = 1;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Normaliza el limite blando a un entero >= 1. Valores no finitos, cero o
 * negativos se elevan a 1. Pura y determinista.
 */
export const slowFloodEffectiveLimit = (softLimit: number): number => {
  if (!Number.isFinite(softLimit)) {
    return SLOW_FLOOD_MIN_SOFT_LIMIT;
  }
  const floored = Math.floor(softLimit);
  return floored < SLOW_FLOOD_MIN_SOFT_LIMIT
    ? SLOW_FLOOD_MIN_SOFT_LIMIT
    : floored;
};

/**
 * Cuenta los mensajes dentro de la ventana [nowMs - windowMs, nowMs] (extremos
 * incluidos). Descarta mensajes futuros (t > nowMs) y, si windowMs <= 0,
 * devuelve 0. Pura y determinista.
 */
export const slowFloodWindowCount = (
  msgTimesMs: readonly number[],
  windowMs: number,
  nowMs: number,
): number => {
  if (windowMs <= 0) {
    return 0;
  }
  const from = nowMs - windowMs;
  let count = 0;
  for (const t of msgTimesMs) {
    if (t >= from && t <= nowMs) {
      count += 1;
    }
  }
  return count;
};

const windowSeconds = (windowMs: number): number =>
  windowMs <= 0 ? 0 : Math.round(windowMs / 1000);

/**
 * Detecta flood lento: marca `suspicious` cuando el numero de mensajes dentro de
 * la ventana LARGA alcanza el limite blando efectivo. A diferencia del antiflood
 * normal (rafagas en ventanas cortas), aqui basta con acumular mensajes
 * espaciados a lo largo de una ventana amplia sin llegar al pico. `reason` es un
 * texto orientado al usuario. Pura y determinista: toda la temporalidad deriva de
 * `nowMs` y `windowMs`.
 */
export const detectSlowFlood = (
  msgTimesMs: readonly number[],
  windowMs: number,
  softLimit: number,
  nowMs: number,
): SlowFloodResult => {
  const limit = slowFloodEffectiveLimit(softLimit);
  const count = slowFloodWindowCount(msgTimesMs, windowMs, nowMs);
  const seconds = windowSeconds(windowMs);

  if (count === 0) {
    return {
      suspicious: false,
      count,
      reason: "Sin actividad en la ventana",
    };
  }

  if (count >= limit) {
    return {
      suspicious: true,
      count,
      reason: `Flood lento: ${count} mensajes en ${seconds}s sin pico`,
    };
  }

  return {
    suspicious: false,
    count,
    reason: `Actividad normal: ${count}/${limit} en ${seconds}s`,
  };
};

/**
 * Adapta la deteccion a la forma comun del motor de senales. `weight` (0..1)
 * escala con la intensidad (mensajes respecto al doble del limite) y `detail`
 * solo se incluye cuando la senal esta presente. Pura y determinista.
 */
export const slowFloodSignal = (
  msgTimesMs: readonly number[],
  windowMs: number,
  softLimit: number,
  nowMs: number,
): SlowFloodSignal => {
  const limit = slowFloodEffectiveLimit(softLimit);
  const result = detectSlowFlood(msgTimesMs, windowMs, softLimit, nowMs);
  const weight = clamp01(result.count / (limit * 2));
  return {
    key: "slow_flood",
    weight,
    present: result.suspicious,
    ...(result.suspicious ? { detail: result.reason } : {}),
  };
};
