/**
 * Circuit breaker por grupo + detector de rate-limit proximo. Logica pura para
 * decidir cuando dejar de golpear un chat/endpoint que esta fallando (patron
 * "circuit breaker": closed -> open -> half-open) y para avisar antes de chocar
 * con un limite de llamadas por ventana. Sin I/O, sin red, sin relojes: el
 * caller pasa `nowMs` y los inputs planos, y este modulo devuelve valores
 * deterministas. Igual que afk.ts / char-filters.ts.
 */

/**
 * Estado persistente del breaker para un grupo. `failures` es el contador de
 * fallos consecutivos, `lastFailureMs` el epoch (ms) del ultimo fallo y
 * `openUntilMs`, si esta presente, el epoch hasta el cual el circuito
 * permanece abierto (bloqueando llamadas).
 */
export interface BreakerState {
  readonly failures: number;
  readonly lastFailureMs: number;
  readonly openUntilMs?: number;
}

/** Opciones de ajuste del breaker; ambos con valores por defecto seguros. */
export interface BreakerOptions {
  readonly failureThreshold?: number;
  readonly openMs?: number;
}

/** Fallos consecutivos por defecto antes de abrir el circuito. */
export const BREAKER_DEFAULT_FAILURE_THRESHOLD = 5;

/** Duracion por defecto (ms) que el circuito permanece abierto. */
export const BREAKER_DEFAULT_OPEN_MS = 30_000;

/** Fase del circuito segun el patron clasico. */
export type BreakerPhase = "closed" | "open" | "half-open";

/**
 * Resultado de evaluar el breaker en un instante dado. `allow` indica si la
 * llamada puede proceder; `reason` es un codigo estable para logs/tests.
 */
export interface BreakerDecision {
  readonly state: BreakerPhase;
  readonly allow: boolean;
  readonly reason: string;
}

const resolveThreshold = (opts?: BreakerOptions): number => {
  const value = opts?.failureThreshold ?? BREAKER_DEFAULT_FAILURE_THRESHOLD;
  return value >= 1 ? Math.floor(value) : 1;
};

const resolveOpenMs = (opts?: BreakerOptions): number => {
  const value = opts?.openMs ?? BREAKER_DEFAULT_OPEN_MS;
  return value >= 0 ? value : 0;
};

/**
 * Evalua el estado del circuito en `nowMs` sin mutar nada:
 * - "open" + allow=false mientras `openUntilMs` este en el futuro.
 * - "half-open" + allow=true en el instante en que expira la ventana abierta
 *   (se permite una llamada de sondeo).
 * - "closed" + allow=true cuando no hay ventana abierta ni se alcanzo el umbral.
 * Nota: un contador de fallos que ya alcanzo el umbral pero sin `openUntilMs`
 * (estado inconsistente) se trata como "half-open" para forzar un sondeo.
 * Puro y determinista.
 */
export const evaluateCircuitBreaker = (
  state: BreakerState,
  nowMs: number,
  opts?: BreakerOptions,
): BreakerDecision => {
  const threshold = resolveThreshold(opts);

  if (state.openUntilMs !== undefined) {
    if (nowMs < state.openUntilMs) {
      return { state: "open", allow: false, reason: "circuit-open" };
    }
    return { state: "half-open", allow: true, reason: "probe-after-open" };
  }

  if (state.failures >= threshold) {
    return { state: "half-open", allow: true, reason: "probe-threshold" };
  }

  return { state: "closed", allow: true, reason: "circuit-closed" };
};

/**
 * Aplica el resultado de una llamada al estado del breaker y devuelve un
 * estado NUEVO (inmutable):
 * - ok=true resetea fallos y limpia `openUntilMs` (circuito cerrado).
 * - ok=false incrementa fallos y sella `lastFailureMs`; al alcanzar el umbral
 *   abre el circuito hasta `nowMs + openMs`.
 * Puro y determinista.
 */
export const recordBreakerResult = (
  state: BreakerState,
  ok: boolean,
  nowMs: number,
  opts?: BreakerOptions,
): BreakerState => {
  if (ok) {
    return { failures: 0, lastFailureMs: state.lastFailureMs };
  }

  const threshold = resolveThreshold(opts);
  const openMs = resolveOpenMs(opts);
  const failures = state.failures + 1;

  if (failures >= threshold) {
    return {
      failures,
      lastFailureMs: nowMs,
      openUntilMs: nowMs + openMs,
    };
  }

  return { failures, lastFailureMs: nowMs };
};

/**
 * Resultado del detector de rate-limit: `used` son las llamadas dentro de la
 * ventana [nowMs - windowMs, nowMs], `headroom` cuantas quedan hasta `limit`
 * (nunca negativo) y `approaching` es true cuando `used` alcanza el 80% del
 * limite o mas (incluye el caso de haberlo superado).
 */
export interface RateLimitStatus {
  readonly approaching: boolean;
  readonly used: number;
  readonly headroom: number;
}

/** Fraccion del limite a partir de la cual se considera "proximo". */
export const RATE_LIMIT_APPROACH_RATIO = 0.8;

/**
 * Detecta si nos acercamos a un rate-limit contando las marcas de tiempo de
 * llamadas recientes que caen dentro de la ventana deslizante. `recentCallMs`
 * son epochs (ms) en cualquier orden; solo cuentan los que estan en
 * (nowMs - windowMs, nowMs]. Con `limit <= 0` siempre esta "approaching" y el
 * headroom es 0. Puro y determinista.
 */
export const detectRateLimitApproaching = (
  recentCallMs: readonly number[],
  limit: number,
  windowMs: number,
  nowMs: number,
): RateLimitStatus => {
  const windowStart = nowMs - windowMs;
  let used = 0;
  for (const callMs of recentCallMs) {
    if (callMs > windowStart && callMs <= nowMs) {
      used += 1;
    }
  }

  if (limit <= 0) {
    return { approaching: true, used, headroom: 0 };
  }

  const headroom = Math.max(0, limit - used);
  const approaching = used >= Math.ceil(limit * RATE_LIMIT_APPROACH_RATIO);

  return { approaching, used, headroom };
};
