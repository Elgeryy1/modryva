/**
 * Seleccion determinista de la trivia diaria. Logica pura: sin I/O, sin red,
 * sin Date.now() ni Math.random(). El mismo dia (mismo dayKey) siempre mapea a
 * la misma pregunta del pool, y dos maquinas con el mismo reloj y zona horaria
 * calculan el mismo dayKey. Los callers pasan nowMs e inputs planos.
 */

/** Milisegundos en un minuto. */
export const DAILY_TRIVIA_MS_PER_MINUTE = 60_000;

/** Milisegundos en una hora. Base del bucket horario. */
export const DAILY_TRIVIA_MS_PER_HOUR = 3_600_000;

/** Milisegundos en un dia (24h). Base del bucket diario. */
export const DAILY_TRIVIA_MS_PER_DAY = 86_400_000;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Hash FNV-1a de 32 bits, sin signo, sobre la cadena de entrada. Estable y
 * determinista: la misma cadena produce siempre el mismo entero en [0, 2^32).
 * No usa Math.random(). Sirve como base para el reparto de la trivia diaria.
 */
export const dailyTriviaHash = (input: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // Math.imul mantiene la multiplicacion en 32 bits (como en C).
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

/**
 * Elige el indice de la pregunta del pool para un dia dado. Determinista:
 * deriva del hash FNV-1a estable de dayKey, nunca de Math.random(). Devuelve un
 * indice en [0, poolSize). Si poolSize no es un entero positivo valido devuelve
 * 0 (fallback seguro). dayKey no entero o no finito se normaliza truncando; los
 * no finitos se tratan como 0.
 */
export const pickDailyIndex = (dayKey: number, poolSize: number): number => {
  if (!Number.isFinite(poolSize)) {
    return 0;
  }
  const size = Math.floor(poolSize);
  if (size <= 0) {
    return 0;
  }
  const key = Number.isFinite(dayKey) ? Math.trunc(dayKey) : 0;
  return dailyTriviaHash(String(key)) % size;
};

/**
 * Calcula la clave de dia (numero de dia entero) para un instante nowMs (epoch
 * ms) ajustado por un desfase de zona horaria en minutos al este de UTC
 * (p.ej. +120 para UTC+2, -300 para UTC-5). Todo instante dentro del mismo dia
 * local cae en el mismo bucket. Determinista. Entradas no finitas se tratan
 * como 0.
 */
export const dayKeyFromMs = (nowMs: number, tzOffsetMin: number): number => {
  const ms = Number.isFinite(nowMs) ? nowMs : 0;
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const shifted = ms + offset * DAILY_TRIVIA_MS_PER_MINUTE;
  return Math.floor(shifted / DAILY_TRIVIA_MS_PER_DAY);
};

/**
 * Calcula la clave de hora (numero de hora entero desde epoch) para nowMs,
 * ajustada por el mismo desfase de zona horaria en minutos que dayKeyFromMs.
 * La usa la trivia horaria: cada hora en punto abre una ventana nueva y todos
 * los miembros del grupo comparten la misma pregunta durante esa hora. Los
 * buckets horarios (~490_000 hoy) nunca colisionan con los diarios (~20_600),
 * asi que un grupo puede alternar cadencia sin mezclar marcadores. Determinista;
 * entradas no finitas se tratan como 0.
 */
export const hourKeyFromMs = (nowMs: number, tzOffsetMin: number): number => {
  const ms = Number.isFinite(nowMs) ? nowMs : 0;
  const offset = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const shifted = ms + offset * DAILY_TRIVIA_MS_PER_MINUTE;
  return Math.floor(shifted / DAILY_TRIVIA_MS_PER_HOUR);
};
