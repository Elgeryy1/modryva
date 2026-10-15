/**
 * Divisiones de temporada y ranking separado para jugadores nuevos.
 * Logica pura y determinista: recibe entradas planas y devuelve valores,
 * sin I/O, sin Prisma, sin red, sin Date.now() ni Math.random().
 *
 * Idea del banco F4/AL: separar a los veteranos de los novatos ("rookies")
 * para que un recien llegado no compita de entrada contra la cima de la
 * clasificacion, y agrupar los puntos en divisiones tipo liga.
 */

/** Una division de temporada con su umbral minimo de puntos (inclusive). */
export interface SeasonDivision {
  readonly id: string;
  readonly label: string;
  readonly minPoints: number;
}

/**
 * Divisiones ordenadas de menor a mayor umbral. Bronce es el suelo (a partir
 * de 0 puntos); diamante la cima. Los umbrales son inclusivos: exactamente
 * `minPoints` ya cuenta como esa division.
 */
export const SEASON_DIVISIONS: readonly SeasonDivision[] = [
  { id: "bronce", label: "Bronce", minPoints: 0 },
  { id: "plata", label: "Plata", minPoints: 1_000 },
  { id: "oro", label: "Oro", minPoints: 5_000 },
  { id: "diamante", label: "Diamante", minPoints: 15_000 },
];

/** Id de la division mas baja; suelo por defecto para puntos negativos. */
const FLOOR_DIVISION_ID: string = SEASON_DIVISIONS[0]?.id ?? "bronce";

/**
 * Devuelve el id de la division correspondiente a `points`: la division mas
 * alta cuyo `minPoints` sea menor o igual a los puntos. Puntos negativos o
 * por debajo del primer umbral caen en la division suelo (bronce).
 * Pura y determinista.
 */
export const divisionForPoints = (points: number): string => {
  let currentId = FLOOR_DIVISION_ID;
  for (const division of SEASON_DIVISIONS) {
    if (points >= division.minPoints) {
      currentId = division.id;
    }
  }
  return currentId;
};

/** Entrada plana de la clasificacion antes de rankear. */
export interface SeasonLeaderboardEntry {
  readonly userId: string;
  readonly points: number;
  readonly isNew: boolean;
}

/** Entrada ya rankeada, con posicion (1-based) y division calculada. */
export interface SeasonRankedEntry {
  readonly userId: string;
  readonly points: number;
  readonly isNew: boolean;
  readonly rank: number;
  readonly division: string;
}

/**
 * Resultado de dividir la clasificacion en dos rankings independientes:
 * `veterans` (isNew=false) y `rookies` (isNew=true). Cada uno se rankea por
 * separado empezando en la posicion 1.
 */
export interface SeasonSplitLeaderboard {
  readonly veterans: readonly SeasonRankedEntry[];
  readonly rookies: readonly SeasonRankedEntry[];
}

/**
 * Ordena un grupo por puntos descendente de forma estable (empates conservan
 * el orden de entrada) y asigna rank 1-based y division a cada entrada.
 */
const rankGroup = (
  group: readonly SeasonLeaderboardEntry[],
): SeasonRankedEntry[] => {
  const indexed = group.map((entry, index) => ({ entry, index }));
  indexed.sort((a, b) => b.entry.points - a.entry.points || a.index - b.index);
  return indexed.map(({ entry }, position) => ({
    userId: entry.userId,
    points: entry.points,
    isNew: entry.isNew,
    rank: position + 1,
    division: divisionForPoints(entry.points),
  }));
};

/**
 * Separa la clasificacion en veteranos y novatos y rankea cada grupo por
 * separado (puntos descendente, orden estable en empates). No muta la entrada.
 * Pura y determinista.
 */
export const splitLeaderboard = (
  entries: readonly SeasonLeaderboardEntry[],
): SeasonSplitLeaderboard => {
  const veteransRaw: SeasonLeaderboardEntry[] = [];
  const rookiesRaw: SeasonLeaderboardEntry[] = [];
  for (const entry of entries) {
    if (entry.isNew) {
      rookiesRaw.push(entry);
    } else {
      veteransRaw.push(entry);
    }
  }
  return {
    veterans: rankGroup(veteransRaw),
    rookies: rankGroup(rookiesRaw),
  };
};
