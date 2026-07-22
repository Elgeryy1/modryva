/**
 * Backoff exponencial con jitter DETERMINISTA para reintentos ante rate-limit
 * (HTTP 429) u otros fallos transitorios. Logica pura: sin I/O, sin red, sin
 * Date.now() y sin Math.random(). El jitter se deriva del numero de intento
 * mediante un hash entero estable, de modo que la misma entrada produce
 * siempre la misma salida (reproducible en tests y entre procesos).
 */

/**
 * Hash entero estable -> fraccion en [0, 1). Mezcla estilo Knuth + xorshift
 * sobre el intento (desplazado en +1 para que attempt=0 no degenere en 0).
 * Solo se usa internamente para derivar el jitter; no realiza ninguna E/S.
 */
const retryJitterFraction = (attempt: number): number => {
  let h = ((attempt + 1) * 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = (h * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
};

/**
 * Calcula la espera (ms) para un intento dado usando backoff exponencial
 * (2^attempt * baseMs) con tope en maxMs y jitter determinista tipo
 * "equal jitter": el resultado cae en el rango [capped/2, capped], donde
 * `capped = min(2^attempt * baseMs, maxMs)`. Siempre >= 0 y <= maxMs.
 *
 * Entradas fuera de rango se sanean: attempt negativo o no finito se trata
 * como 0; baseMs/maxMs no positivos o no finitos hacen que devuelva 0. El
 * resultado es un entero (ms) y puro determinista.
 */
export const computeBackoffMs = (
  attempt: number,
  baseMs: number,
  maxMs: number,
): number => {
  const safeAttempt =
    Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const safeBase = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 0;
  const safeMax = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : 0;

  if (safeBase === 0 || safeMax === 0) {
    return 0;
  }

  const exponential = safeBase * 2 ** safeAttempt;
  const capped = Math.min(exponential, safeMax);
  const half = capped / 2;
  const jitter = half * retryJitterFraction(safeAttempt);

  return Math.floor(half + jitter);
};

/**
 * Decide si conviene reintentar: true mientras el numero de intentos ya
 * realizados (`attempt`, base 0) sea menor que `maxAttempts`. Devuelve false
 * ante entradas no finitas, attempt negativo o maxAttempts no positivo. Pura
 * y determinista.
 */
export const shouldRetry = (attempt: number, maxAttempts: number): boolean => {
  if (!Number.isFinite(attempt) || !Number.isFinite(maxAttempts)) {
    return false;
  }
  if (maxAttempts <= 0 || attempt < 0) {
    return false;
  }
  return attempt < maxAttempts;
};
