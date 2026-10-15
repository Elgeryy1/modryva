/**
 * Deteccion de raid: rafaga de uniones (muchas cuentas entrando juntas) y
 * multi-cuenta coordinada (nombres muy parecidos entre si). Alimenta el motor
 * de senales devolviendo la forma comun { key, weight, present, detail? } sin
 * depender de signals.ts. Todo es logica pura y determinista: no hace I/O ni
 * usa Date.now()/Math.random(); recibe nowMs y las uniones como datos planos.
 */

/** Una union al grupo: nombre mostrado y epoch (ms) en que ocurrio. */
export interface RaidJoin {
  readonly name: string;
  readonly ms: number;
}

/** Senal en la forma comun del motor. `detail` es opcional y diagnostico. */
export interface RaidSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Minimo de uniones en la ventana para considerar rafaga sospechosa. */
export const RAID_BURST_MIN_JOINS = 5;

/** Minimo de nombres parecidos entre si para considerar multi-cuenta. */
export const RAID_SIMILAR_MIN_GROUP = 3;

/** Umbral de similitud (0..1) a partir del cual dos nombres cuentan como parecidos. */
export const RAID_NAME_SIMILARITY_THRESHOLD = 0.8;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Normaliza un nombre para comparar: recorta, pasa a minusculas y colapsa
 * espacios internos en uno solo. Pura y determinista.
 */
export const raidNormalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

/** Distancia de edicion (Levenshtein) entre dos cadenas. */
const levenshtein = (a: string, b: string): number => {
  const al = a.length;
  const bl = b.length;
  if (al === 0) {
    return bl;
  }
  if (bl === 0) {
    return al;
  }

  let prev: number[] = [];
  for (let j = 0; j <= bl; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= al; i += 1) {
    const curr: number[] = [i];
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j += 1) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    prev = curr;
  }

  return prev[bl] ?? 0;
};

/**
 * Similitud (0..1) entre dos nombres, 1 = identicos tras normalizar. Se basa en
 * la distancia de edicion normalizada por la longitud mayor. Dos cadenas vacias
 * se consideran identicas. Pura y determinista.
 */
export const raidNameSimilarity = (a: string, b: string): number => {
  const x = raidNormalizeName(a);
  const y = raidNormalizeName(b);
  const maxLen = Math.max(x.length, y.length);
  if (maxLen === 0) {
    return 1;
  }
  return 1 - levenshtein(x, y) / maxLen;
};

/**
 * Tamano del mayor grupo de nombres mutuamente parecidos: para cada nombre
 * cuenta cuantos (incluido el mismo) tienen similitud >= threshold y devuelve el
 * maximo. Lista vacia -> 0. Pura y determinista.
 */
export const raidLargestSimilarGroup = (
  names: readonly string[],
  threshold: number,
): number => {
  let best = 0;
  for (let i = 0; i < names.length; i += 1) {
    const a = names[i] ?? "";
    let size = 0;
    for (let j = 0; j < names.length; j += 1) {
      const b = names[j] ?? "";
      if (raidNameSimilarity(a, b) >= threshold) {
        size += 1;
      }
    }
    if (size > best) {
      best = size;
    }
  }
  return best;
};

/**
 * Uniones dentro de la ventana [nowMs - windowMs, nowMs] (extremos incluidos).
 * Descarta uniones futuras (ms > nowMs) y, si windowMs <= 0, devuelve vacio.
 * Preserva el orden de entrada. Pura y determinista.
 */
export const raidRecentJoins = (
  joins: readonly RaidJoin[],
  windowMs: number,
  nowMs: number,
): RaidJoin[] => {
  if (windowMs <= 0) {
    return [];
  }
  const from = nowMs - windowMs;
  return joins.filter((j) => j.ms >= from && j.ms <= nowMs);
};

/**
 * Detecta senales de raid a partir de las uniones recientes. Devuelve siempre
 * dos senales en la forma comun del motor:
 *  - `raid_join_burst`: muchas uniones juntas dentro de la ventana.
 *  - `raid_name_similarity`: muchos nombres muy parecidos entre si (multi-cuenta
 *    coordinada).
 * `present` marca si la senal supera su umbral; `weight` (0..1) escala con la
 * intensidad; `detail` solo se incluye cuando la senal esta presente. Pura y
 * determinista: toda la temporalidad deriva de `nowMs` y `windowMs`.
 */
export const detectRaidSignals = (
  joins: readonly RaidJoin[],
  windowMs: number,
  nowMs: number,
): RaidSignal[] => {
  const recent = raidRecentJoins(joins, windowMs, nowMs);
  const count = recent.length;

  const burstPresent = count >= RAID_BURST_MIN_JOINS;
  const burstWeight = clamp01(count / (RAID_BURST_MIN_JOINS * 2));
  const burst: RaidSignal = {
    key: "raid_join_burst",
    weight: burstWeight,
    present: burstPresent,
    ...(burstPresent ? { detail: `${count} uniones en ${windowMs} ms` } : {}),
  };

  const group = raidLargestSimilarGroup(
    recent.map((j) => j.name),
    RAID_NAME_SIMILARITY_THRESHOLD,
  );
  const similarPresent = group >= RAID_SIMILAR_MIN_GROUP;
  const similarWeight = clamp01(group / (RAID_SIMILAR_MIN_GROUP * 2));
  const similarity: RaidSignal = {
    key: "raid_name_similarity",
    weight: similarWeight,
    present: similarPresent,
    ...(similarPresent ? { detail: `${group} nombres similares` } : {}),
  };

  return [burst, similarity];
};
