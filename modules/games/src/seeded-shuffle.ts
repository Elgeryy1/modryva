/**
 * Barajado determinista a partir de una semilla.
 *
 * Los juegos de grupo tienen que repartir: quien es el impostor, que cartas le
 * tocan a cada uno. Eso no puede salir de `Math.random` por dos motivos: estos
 * modulos son puros y ademas un reparto que no se puede reproducir no se puede
 * auditar. Con semilla, "me ha tocado impostor tres veces seguidas" se
 * comprueba en vez de discutirse.
 *
 * La semilla la elige quien llama (normalmente derivada del id de la partida),
 * y se guarda con el estado.
 */

/** Mezclador entero de 32 bits (variante mulberry32), como en memory-game. */
const hashStep = (state: number): number => {
  let z = (state + 0x6d2b79f5) | 0;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return (z ^ (z >>> 14)) >>> 0;
};

/**
 * Un generador con estado propio. Cada llamada avanza; la misma semilla da
 * siempre la misma serie.
 */
export interface SeededRng {
  /** Entero en [0, max). Devuelve 0 si `max` no es un entero positivo. */
  nextInt(max: number): number;
}

export const makeRng = (seed: number): SeededRng => {
  let state = Number.isFinite(seed) ? Math.floor(seed) | 0 : 0;
  return {
    nextInt(max: number): number {
      if (!Number.isFinite(max) || max < 1) {
        return 0;
      }
      state = hashStep(state) | 0;
      const span = Math.floor(max);
      return ((hashStep(state) % span) + span) % span;
    },
  };
};

/**
 * Semilla estable a partir de un texto (el id de la partida).
 *
 * Se usa el id y no la hora porque el reparto tiene que poder recalcularse
 * mañana exactamente igual que hoy.
 */
export const seedFrom = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h | 0;
};

/**
 * Fisher-Yates. Devuelve una copia; no toca la lista original.
 *
 * Recorrido hacia atras a proposito: la version "hacia delante" con
 * `nextInt(n)` en cada paso es el error clasico que sesga el resultado — deja
 * de repartir permutaciones por igual y en un juego social eso significa que
 * ciertos asientos salen impostor mas a menudo.
 */
export const shuffle = <T>(items: readonly T[], rng: SeededRng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
};

/** Un elemento al azar, o null si no hay nada que elegir. */
export const pickOne = <T>(items: readonly T[], rng: SeededRng): T | null =>
  items.length === 0 ? null : (items[rng.nextInt(items.length)] as T);
