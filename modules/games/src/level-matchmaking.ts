/**
 * Emparejamiento por nivel para partidas 1v1.
 * Logica pura y determinista: recibe entradas planas y devuelve valores,
 * sin I/O, sin Prisma, sin red, sin Date.now() ni Math.random().
 *
 * Idea del banco (#749): agrupar jugadores por nivel para que se enfrenten
 * rivales de fuerza parecida. Se ordena por nivel ascendente (y por id como
 * desempate estable) y se emparejan de forma consecutiva; si el numero de
 * jugadores es impar, el ultimo se queda sin pareja y se descarta.
 */

/** Jugador candidato al emparejamiento, con su nivel actual. */
export interface RankedPlayer {
  readonly id: string;
  readonly level: number;
}

/**
 * Una pareja de rivales como tupla de ids `[a, b]`, donde `a` es el jugador
 * con menor nivel (o menor id en caso de empate de nivel).
 */
export type LevelMatch = readonly [string, string];

/**
 * Compara dos ids de forma lexicografica ascendente y estable.
 * Devuelve -1, 0 o 1. Pura y determinista.
 */
const compareIds = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/**
 * Empareja jugadores por nivel: los ordena por nivel ascendente y, ante
 * empate de nivel, por id ascendente; luego forma parejas consecutivas.
 * Con un numero impar de jugadores, el ultimo (el de mayor nivel/id) se
 * queda sin pareja y no aparece en el resultado. No muta la entrada.
 * Pura y determinista.
 */
export const matchByLevel = (
  players: readonly RankedPlayer[],
): readonly LevelMatch[] => {
  const sorted = [...players].sort(
    (a, b) => a.level - b.level || compareIds(a.id, b.id),
  );
  const pairs: LevelMatch[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const first = sorted[i];
    const second = sorted[i + 1];
    if (first === undefined || second === undefined) {
      continue;
    }
    pairs.push([first.id, second.id]);
  }
  return pairs;
};
