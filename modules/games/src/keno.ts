// KENO — variante simplificada: el jugador elige EXACTAMENTE 3 números de un
// rango 1..20 (conteo fijo, no configurable) para mantener tratable la
// combinatoria de la paytable; un keno real deja elegir 1-10 números de un
// rango 1-80, lo que multiplicaría el número de tablas de pago a derivar.
//
// This module is PURE + DETERMINISTIC: the 5 drawn numbers derive entirely
// from (serverSeed, clientSeed, nonce) via the provably-fair `fairShuffle`
// helper, so anyone can recompute and verify any draw. No I/O, clock,
// network, or Math.random.
//
// SORTEO SIN REPETICIÓN: fairShuffle(serverSeed, clientSeed, nonce, 20) ya
// implementa un Fisher-Yates parcial verificable sobre [0, 20) — cada swap usa
// un cursor propio (ver fairness.ts), así que el shuffle entero es
// reproducible. Tomamos los primeros 5 elementos del resultado (garantizado
// sin repetición por construcción del Fisher-Yates) y les sumamos 1 para
// mapear [0,19] -> [1,20].
//
// PROBABILIDAD HIPERGEOMÉTRICA (exacta): con 20 números, 3 elegidos por el
// jugador y 5 SORTEADOS por la casa, la probabilidad de acertar exactamente
// k de los 3 elegidos es:
//   P(k) = C(3,k) * C(17, 5-k) / C(20,5)   para k = 0,1,2,3
// donde C(n,r) son combinaciones y C(20,5) = 15504 (¡las 5 sorteadas cuentan!).
//   P(0) = C(3,0)*C(17,5)/15504 = 1*6188/15504 ≈ 0.399123
//   P(1) = C(3,1)*C(17,4)/15504 = 3*2380/15504 ≈ 0.460526
//   P(2) = C(3,2)*C(17,3)/15504 = 3*680 /15504 ≈ 0.131579
//   P(3) = C(3,3)*C(17,2)/15504 = 1*136 /15504 ≈ 0.008772
// Suma = 15504/15504 = 1 ✓.
//
// PAYTABLE: se GANA con 2 o 3 aciertos; 0 o 1 aciertos PIERDEN (multiplicador 0),
// como en el keno real (acertar pocos de pocos casi nunca paga). El presupuesto
// de EV (1 - houseEdge) se reparte a partes iguales entre los niveles ganadores,
// cada uno tasado de forma justa por su propia probabilidad:
//   multiplier(k) = floor( (1 - houseEdge) / (nivelesGanadores * P(k)) )  para k>=2
// Así el house edge GLOBAL (ponderado por la P real) es ~2%, porque
//   EV = Σ_{k>=2} P(k)·mult(k) ≈ (1 - houseEdge).
// Acertar los 3 (k=3, ~0.88%) paga el premio gordo (~55×); 2 aciertos ~3.7×.

import { CASINO } from "./casino.js";
import { fairShuffle } from "./fairness.js";

export const KENO_RANGE = 20;
export const KENO_DRAWN_COUNT = 5;
export const KENO_PICK_COUNT = 3;

/** C(n, r) — combinaciones, n y r enteros no negativos, r <= n. */
const combinations = (n: number, r: number): number => {
  if (r < 0 || r > n) {
    return 0;
  }
  let result = 1;
  for (let i = 0; i < r; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
};

// Total de maneras de sortear 5 de 20 (¡no 3!): C(20,5) = 15504.
const TOTAL_COMBINATIONS = combinations(KENO_RANGE, KENO_DRAWN_COUNT);

/** Probabilidad hipergeométrica exacta de acertar exactamente k de los 3 elegidos. */
const hitProbability = (k: 0 | 1 | 2 | 3): number =>
  (combinations(KENO_PICK_COUNT, k) *
    combinations(KENO_RANGE - KENO_PICK_COUNT, KENO_DRAWN_COUNT - k)) /
  TOTAL_COMBINATIONS;

/** Se gana a partir de este número de aciertos; por debajo, el multiplicador es 0. */
export const KENO_WIN_THRESHOLD = 2;
// Cuántos niveles de aciertos pagan (WIN_THRESHOLD..PICK_COUNT): {2,3} = 2.
const KENO_WINNING_LEVELS = KENO_PICK_COUNT - KENO_WIN_THRESHOLD + 1;

/**
 * Multiplicador (× stake) para cada nivel de aciertos. Con menos de
 * KENO_WIN_THRESHOLD aciertos se PIERDE (0). Para los niveles ganadores se
 * reparte el presupuesto de EV (1 - houseEdge) a partes iguales entre ellos,
 * tasando cada uno por su propia probabilidad, de modo que el house edge GLOBAL
 * (ponderado por la P real de cada nivel) es ~2%. Truncado a 2 decimales hacia
 * abajo para que el redondeo nunca favorezca al jugador.
 */
const kenoMultiplierForHits = (
  hits: 0 | 1 | 2 | 3,
  edge = CASINO.houseEdge,
): number => {
  if (hits < KENO_WIN_THRESHOLD) {
    return 0;
  }
  const p = hitProbability(hits);
  if (p <= 0) {
    return 0;
  }
  const raw = (1 - edge) / (KENO_WINNING_LEVELS * p);
  return Math.floor(raw * 100) / 100;
};

/** Paytable pública: multiplicador × stake para cada conteo de aciertos 0-3. */
export const KENO_PAYTABLE: Record<0 | 1 | 2 | 3, number> = {
  0: kenoMultiplierForHits(0),
  1: kenoMultiplierForHits(1),
  2: kenoMultiplierForHits(2),
  3: kenoMultiplierForHits(3),
};

/**
 * Sortea 5 números distintos en [1, 20] derivados de forma determinista de
 * (serverSeed, clientSeed, nonce). El orden del array no es relevante para el
 * juego (solo importa el conjunto).
 */
export const drawKeno = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number[] => {
  const shuffled = fairShuffle(serverSeed, clientSeed, nonce, KENO_RANGE);
  return shuffled.slice(0, KENO_DRAWN_COUNT).map((index) => index + 1);
};

/**
 * Cuenta cuántos de los `picks` del jugador (deben ser exactamente 3 números
 * distintos en [1,20]) están entre los `drawn` (5 números sorteados) y
 * devuelve el multiplicador de la paytable para ese conteo de aciertos.
 */
export const kenoMultiplier = (picks: number[], drawn: number[]): number => {
  const drawnSet = new Set(drawn);
  const hits = picks.filter((n) => drawnSet.has(n)).length;
  const clamped = Math.max(0, Math.min(KENO_PICK_COUNT, hits)) as 0 | 1 | 2 | 3;
  return KENO_PAYTABLE[clamped];
};
