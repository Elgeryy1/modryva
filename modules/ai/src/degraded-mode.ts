/**
 * Politica de "modo degradado" a nivel grupo cuando la IA falla de forma
 * repetida o se agota el presupuesto. Vive por encima del circuit breaker del
 * AiRouter: el router protege una sola llamada; esta politica decide si el
 * grupo debe dejar de intentar por un rato y mostrar un aviso suave.
 *
 * Logica pura: recibe el estado observado y el reloj (nowMs) por parametro y
 * devuelve una decision determinista. Sin I/O, sin red, sin Date.now(). Nunca
 * lanza: cualquier entrada anomala degrada de forma segura.
 */

/**
 * Estado acumulado de fallos de IA para un grupo. Los timestamps son epoch en
 * milisegundos; el llamador los provee para mantener este modulo puro.
 */
export interface DegradedState {
  readonly consecutiveFailures: number;
  readonly lastFailureMs: number;
  readonly budgetExceeded: boolean;
}

/** Opciones de ajuste de la politica; todas tienen valor por defecto. */
export interface DegradedModeOptions {
  readonly failureThreshold?: number;
  readonly cooldownMs?: number;
}

/** Resultado de la decision de modo degradado. */
export interface DegradedModeDecision {
  readonly degraded: boolean;
  readonly reason: string;
  readonly retryAtMs: number | null;
}

/**
 * Numero de fallos consecutivos por defecto que disparan el modo degradado.
 */
export const DEGRADED_MODE_FAILURE_THRESHOLD = 3;

/**
 * Ventana por defecto (ms) durante la cual se mantiene el modo degradado tras
 * el ultimo fallo antes de permitir un reintento (5 minutos).
 */
export const DEGRADED_MODE_COOLDOWN_MS = 5 * 60_000;

/** Motivos posibles de la decision, como union de literales estable. */
export type DegradedModeReason =
  | "ok"
  | "budget-exceeded"
  | "failure-threshold"
  | "cooling-down";

const sanitizeCount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const sanitizePositive = (
  value: number | undefined,
  fallback: number,
): number =>
  value !== undefined && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

/**
 * Decide si el grupo esta en modo degradado dado su estado y el reloj actual.
 *
 * Reglas, en orden de prioridad:
 * 1. `budgetExceeded` degrada de inmediato, sin reintento programado
 *    (`retryAtMs` = null): lo levanta un reset externo de presupuesto.
 * 2. Alcanzar `failureThreshold` fallos consecutivos degrada y programa el
 *    reintento en `lastFailureMs + cooldownMs`. Si ese instante ya paso segun
 *    `nowMs`, se permite reintentar (no degradado) para no bloquear para
 *    siempre.
 * 3. En cualquier otro caso, no degradado.
 *
 * Nunca lanza: recuentos no finitos o negativos se tratan como 0 y opciones
 * invalidas caen a los valores por defecto.
 */
export const decideDegradedMode = (
  state: DegradedState,
  nowMs: number,
  opts?: DegradedModeOptions,
): DegradedModeDecision => {
  const threshold = sanitizePositive(
    opts?.failureThreshold,
    DEGRADED_MODE_FAILURE_THRESHOLD,
  );
  const cooldownMs = sanitizePositive(
    opts?.cooldownMs,
    DEGRADED_MODE_COOLDOWN_MS,
  );

  if (state.budgetExceeded) {
    return {
      degraded: true,
      reason: "budget-exceeded",
      retryAtMs: null,
    };
  }

  const failures = sanitizeCount(state.consecutiveFailures);

  if (failures >= threshold) {
    const lastFailureMs = Number.isFinite(state.lastFailureMs)
      ? state.lastFailureMs
      : nowMs;
    const retryAtMs = lastFailureMs + cooldownMs;

    if (Number.isFinite(nowMs) && nowMs >= retryAtMs) {
      return {
        degraded: false,
        reason: "cooling-down",
        retryAtMs,
      };
    }

    return {
      degraded: true,
      reason: "failure-threshold",
      retryAtMs,
    };
  }

  return {
    degraded: false,
    reason: "ok",
    retryAtMs: null,
  };
};

/**
 * Convierte un motivo de decision en un aviso corto en espanol-neutro apto para
 * mostrar en el chat. Motivos desconocidos caen a un mensaje generico, asi que
 * esta funcion nunca lanza.
 */
export const formatDegradedNotice = (reason: string): string => {
  switch (reason) {
    case "budget-exceeded":
      return "🚧 La IA esta en pausa: se agoto el presupuesto de este grupo. Volvera cuando se renueve.";
    case "failure-threshold":
      return "🚧 La IA esta teniendo problemas y se pauso temporalmente. Reintenta en un rato.";
    case "cooling-down":
      return "✅ La IA vuelve a estar disponible. Puedes intentarlo de nuevo.";
    case "ok":
      return "✅ La IA esta operativa.";
    default:
      return "🚧 La IA no esta disponible ahora mismo. Intentalo mas tarde.";
  }
};
