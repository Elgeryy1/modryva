/**
 * Minijuego de memoria (secuencia de numeros). El bot muestra una secuencia
 * generada de forma determinista a partir de una semilla; el jugador la
 * reproduce y se compara contra la esperada. Logica pura: sin I/O, sin
 * Math.random ni Date.now, misma semilla => misma secuencia.
 */

/**
 * Hash entero determinista (variante mulberry32) que mezcla un estado de 32
 * bits y devuelve un entero sin signo. Sirve como fuente de aleatoriedad
 * reproducible sin depender de Math.random. Pura y deterministica.
 */
const hashStep = (state: number): number => {
  let z = (state + 0x6d2b79f5) | 0;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return (z ^ (z >>> 14)) >>> 0;
};

/**
 * Genera una secuencia de numeros pseudoaleatorios en el rango [0, maxValue]
 * (ambos inclusive) a partir de `seed`. Deterministica: la misma terna
 * (seed, length, maxValue) produce siempre la misma secuencia. `length` y
 * `maxValue` negativos o no enteros se saturan a un minimo seguro: length se
 * trata como 0 si es < 0, y maxValue como 0 si es < 0 (secuencia de ceros).
 * Pura, sin Math.random.
 */
export const generateMemorySequence = (
  seed: number,
  length: number,
  maxValue: number,
): readonly number[] => {
  const safeLength = Number.isFinite(length)
    ? Math.max(0, Math.floor(length))
    : 0;
  const safeMax = Number.isFinite(maxValue)
    ? Math.max(0, Math.floor(maxValue))
    : 0;
  const span = safeMax + 1;

  const out: number[] = [];
  // Estado inicial derivado de la semilla; un seed no entero se normaliza.
  let state = Number.isFinite(seed) ? Math.floor(seed) | 0 : 0;

  for (let i = 0; i < safeLength; i += 1) {
    state = hashStep(state) | 0;
    const value = ((hashStep(state) % span) + span) % span;
    out.push(value);
  }

  return out;
};

/**
 * Resultado de comparar la secuencia esperada contra la introducida. `correct`
 * es true solo cuando ambas tienen la misma longitud y todos los elementos
 * coinciden en orden. `matched` cuenta los elementos correctos por posicion,
 * contando solo hasta la longitud minima de ambas.
 */
export interface MemoryAnswerResult {
  readonly correct: boolean;
  readonly matched: number;
}

/**
 * Compara la secuencia esperada con la dada posicion a posicion. Devuelve el
 * numero de aciertos por posicion (`matched`) y si la respuesta es
 * completamente correcta (`correct`): misma longitud y todos los elementos
 * iguales. Pura y deterministica.
 */
export const checkMemoryAnswer = (
  expected: readonly number[],
  given: readonly number[],
): MemoryAnswerResult => {
  const limit = Math.min(expected.length, given.length);
  let matched = 0;

  for (let i = 0; i < limit; i += 1) {
    const e = expected[i];
    const g = given[i];
    if (e !== undefined && g !== undefined && e === g) {
      matched += 1;
    }
  }

  const correct =
    expected.length === given.length && matched === expected.length;

  return { correct, matched };
};
