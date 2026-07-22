/**
 * Estadisticas de un jugador en un juego, usadas para el analisis anti-bot.
 * Un avgReactionMs de 0 significa "no medido" y no se evalua.
 * Pure and deterministic.
 */
export interface GameStats {
  /** Numero de partidas ganadas. */
  readonly wins: number;
  /** Numero total de partidas jugadas. */
  readonly plays: number;
  /** Tiempo medio de reaccion en milisegundos. Usa 0 cuando no se ha medido. */
  readonly avgReactionMs: number;
}

/**
 * Umbrales configurables del detector. Cualquier campo omitido usa su valor por defecto.
 * Pure and deterministic.
 */
export interface ImpossiblePatternThresholds {
  /** Minimo de partidas necesario para juzgar la tasa de victorias. */
  readonly minPlays?: number;
  /** Tasa maxima de victorias humanamente plausible, en el rango 0..1. */
  readonly maxWinRate?: number;
  /** Tiempo de reaccion minimo humanamente plausible, en milisegundos. */
  readonly minReactionMs?: number;
}

/**
 * Resultado del analisis: si el patron es sospechoso y los motivos detectados.
 * Los motivos van en orden estable: datos incoherentes, tasa de victorias, reaccion.
 * Pure and deterministic.
 */
export interface ImpossiblePatternResult {
  readonly suspicious: boolean;
  readonly reasons: readonly string[];
}

// Minimo de partidas por defecto para evaluar la tasa de victorias.
const DEFAULT_MIN_PLAYS = 20;
// Tasa de victorias maxima por defecto considerada humana (95%).
const DEFAULT_MAX_WIN_RATE = 0.95;
// Tiempo de reaccion minimo por defecto considerado humano (120 ms).
const DEFAULT_MIN_REACTION_MS = 120;

/**
 * Detecta patrones "perfectos imposibles" tipicos de bots en juegos:
 * una tasa de victorias inhumanamente alta sobre suficientes partidas,
 * un tiempo de reaccion imposiblemente bajo, o registros incoherentes
 * (mas victorias que partidas). Datos invalidos (no finitos, plays no
 * positivo, valores negativos) se tratan como "sin datos". No usa reloj
 * ni azar.
 * Pure and deterministic.
 */
export const detectImpossiblePattern = (
  stats: GameStats,
  thresholds: ImpossiblePatternThresholds = {},
): ImpossiblePatternResult => {
  const minPlays = thresholds.minPlays ?? DEFAULT_MIN_PLAYS;
  const maxWinRate = thresholds.maxWinRate ?? DEFAULT_MAX_WIN_RATE;
  const minReactionMs = thresholds.minReactionMs ?? DEFAULT_MIN_REACTION_MS;

  const { wins, plays, avgReactionMs } = stats;

  const validData =
    Number.isFinite(wins) &&
    Number.isFinite(plays) &&
    Number.isFinite(avgReactionMs) &&
    plays > 0 &&
    wins >= 0 &&
    avgReactionMs >= 0;

  if (!validData) {
    return { suspicious: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (wins > plays) {
    reasons.push("🚫 Datos imposibles: hay más victorias que partidas");
  }

  const effectiveWins = wins > plays ? plays : wins;
  const winRate = effectiveWins / plays;

  if (plays >= minPlays && winRate > maxWinRate) {
    const pct = Math.round(winRate * 100);
    reasons.push(
      `🎯 Tasa de victorias imposible: ${pct}% en ${plays} partidas`,
    );
  }

  if (avgReactionMs > 0 && avgReactionMs < minReactionMs) {
    reasons.push(
      `⚡ Tiempo de reacción inhumano: ${avgReactionMs} ms de media`,
    );
  }

  return { suspicious: reasons.length > 0, reasons };
};
