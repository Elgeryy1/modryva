/**
 * Whether a milestone was reached and how many recent conflicts there were,
 * used to decide how loudly to celebrate. Pure and deterministic.
 */
export interface CelebrationInput {
  readonly milestone: boolean;
  readonly recentConflicts: number;
}

/** Options for decideCelebrationMode. */
export interface CelebrationOptions {
  readonly maxConflicts?: number;
}

/**
 * The chosen celebration mode and a user-facing Spanish message.
 * Pure and deterministic.
 */
export interface CelebrationDecision {
  readonly mode: "publica" | "silenciosa" | "ninguna";
  readonly message: string;
}

/**
 * Decides how to celebrate a milestone: none when there is no milestone, a
 * quiet acknowledgement when the group has too many recent conflicts (default
 * threshold 3), otherwise a public celebration. Pure and deterministic.
 */
export const decideCelebrationMode = (
  input: CelebrationInput,
  options?: CelebrationOptions,
): CelebrationDecision => {
  const maxConflicts = options?.maxConflicts ?? 3;
  if (!input.milestone) {
    return { mode: "ninguna", message: "Sin hito que celebrar." };
  }
  if (input.recentConflicts > maxConflicts) {
    return {
      mode: "silenciosa",
      message: "🎉 Hito alcanzado. Se reconoce sin ruido por el clima tenso.",
    };
  }
  return {
    mode: "publica",
    message: "🎉 ¡Enhorabuena! Hito del grupo celebrado.",
  };
};
