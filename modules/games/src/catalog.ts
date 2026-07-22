// Arcade catalog + server-side anti-cheat helpers. Pure and deterministic. The
// api uses these to validate a submitted score against the game's plausibility
// caps and to normalize the raw score to 0..3 points (so arcade points stay
// comparable with quiz/trivia in the shared GameScore leaderboard).

export type GameId =
  | "reflex"
  | "quiz-arcade"
  | "memory"
  | "math-sprint"
  | "tictactoe"
  | "rps";

export interface GameSpec {
  readonly id: GameId;
  readonly title: string;
  readonly emoji: string;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly maxRawScore: number;
}

export const GAME_CATALOG: Record<GameId, GameSpec> = {
  reflex: {
    id: "reflex",
    title: "Reflejos",
    emoji: "⚡",
    minDurationMs: 800,
    maxDurationMs: 120_000,
    maxRawScore: 100,
  },
  "quiz-arcade": {
    id: "quiz-arcade",
    title: "Quiz Arcade",
    emoji: "🧠",
    minDurationMs: 3_000,
    maxDurationMs: 300_000,
    maxRawScore: 8,
  },
  memory: {
    id: "memory",
    title: "Parejas",
    emoji: "🃏",
    minDurationMs: 3_000,
    maxDurationMs: 300_000,
    maxRawScore: 100,
  },
  "math-sprint": {
    id: "math-sprint",
    title: "Cálculo Rápido",
    emoji: "➗",
    minDurationMs: 3_000,
    maxDurationMs: 90_000,
    maxRawScore: 20,
  },
  // Turn-based games vs a beatable CPU. The raw score is the round outcome
  // (tres en raya: win 3 / draw 1 / loss 0) or rounds won (rps: 0..5, best of 5).
  // A generous duration window absorbs slow thinkers without letting a 0 ms
  // scripted submit through.
  tictactoe: {
    id: "tictactoe",
    title: "Tres en raya",
    emoji: "⭕",
    minDurationMs: 800,
    maxDurationMs: 600_000,
    maxRawScore: 3,
  },
  rps: {
    id: "rps",
    title: "Piedra, papel o tijera",
    emoji: "✊",
    minDurationMs: 800,
    maxDurationMs: 600_000,
    maxRawScore: 5,
  },
};

export const GAME_IDS = Object.keys(GAME_CATALOG) as GameId[];

export const isGameId = (value: string): value is GameId =>
  Object.hasOwn(GAME_CATALOG, value);

/**
 * A score is plausible only when it is within the game's raw range AND the
 * server-measured elapsed time is inside the game's expected window. This is the
 * cheap first line of defense — it does not make client scores unforgeable, but
 * it bounds them and rejects the obvious (0 ms runs, impossible totals).
 */
export const isPlausibleScore = (
  game: GameId,
  rawScore: number,
  elapsedMs: number,
): boolean => {
  const spec = GAME_CATALOG[game];
  if (
    !Number.isFinite(rawScore) ||
    rawScore < 0 ||
    rawScore > spec.maxRawScore
  ) {
    return false;
  }
  if (elapsedMs < spec.minDurationMs || elapsedMs > spec.maxDurationMs) {
    return false;
  }
  return true;
};

/** Normalizes a raw score to 0..3 points for the shared leaderboard. */
export const scoreToPoints = (game: GameId, rawScore: number): number => {
  const spec = GAME_CATALOG[game];
  const clamped = Math.max(0, Math.min(spec.maxRawScore, rawScore));
  const fraction = spec.maxRawScore > 0 ? clamped / spec.maxRawScore : 0;
  return Math.max(0, Math.min(3, Math.round(fraction * 3)));
};
