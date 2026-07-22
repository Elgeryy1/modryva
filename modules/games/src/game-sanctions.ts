/**
 * Possible game-only sanction levels, ordered from least to most severe.
 * These sanctions apply ONLY to the games subsystem and never touch normal
 * chat behaviour. Pure and deterministic.
 */
export type GameSanctionKind =
  | "ninguna"
  | "aviso"
  | "suspension_juegos"
  | "reset_puntos";

/**
 * Input for a game-sanction decision. abuseScore is a non-negative severity
 * signal accumulated from game abuse (cheating, spam plays, exploit attempts).
 * Pure and deterministic.
 */
export interface GameSanctionInput {
  readonly abuseScore: number;
}

/**
 * Outcome of a game-sanction decision. scopeChat is ALWAYS false: this module
 * guarantees game sanctions never affect a user's normal chat privileges.
 * Pure and deterministic.
 */
export interface GameSanctionDecision {
  readonly sanction: GameSanctionKind;
  readonly scopeChat: false;
}

/** Score at or above which a warning is issued. */
const AVISO_THRESHOLD = 20;
/** Score at or above which games are suspended. */
const SUSPENSION_THRESHOLD = 50;
/** Score at or above which the user's game points are reset. */
const RESET_THRESHOLD = 80;

/**
 * Resolves the game sanction level for a given abuseScore. Escalates through
 * "ninguna" -> "aviso" -> "suspension_juegos" -> "reset_puntos" as the score
 * grows. Non-finite or non-positive scores yield "ninguna" (no sanction).
 * The result always has scopeChat === false, so normal chat is never affected.
 * Pure and deterministic.
 */
export const decideGameSanction = (
  input: GameSanctionInput,
): GameSanctionDecision => {
  const score = input.abuseScore;
  if (!Number.isFinite(score) || score <= 0) {
    return { sanction: "ninguna", scopeChat: false };
  }
  if (score >= RESET_THRESHOLD) {
    return { sanction: "reset_puntos", scopeChat: false };
  }
  if (score >= SUSPENSION_THRESHOLD) {
    return { sanction: "suspension_juegos", scopeChat: false };
  }
  if (score >= AVISO_THRESHOLD) {
    return { sanction: "aviso", scopeChat: false };
  }
  return { sanction: "ninguna", scopeChat: false };
};
