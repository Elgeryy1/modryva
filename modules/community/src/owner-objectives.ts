/**
 * Owner objectives tracking for a managed community: a small, fixed catalogue
 * of high-level goals the group owner cares about, plus pure helpers to score
 * and render their progress. No I/O, no clock, no randomness; callers pass in
 * plain progress records so this module stays deterministic and testable.
 */

/**
 * Canonical owner objectives, in display order. Each entry is a stable slug
 * used as the `objective` key in ObjectiveProgress. Do not reorder or rename
 * without a data migration: persisted progress references these slugs.
 */
export const OWNER_OBJECTIVES = [
  "crecer",
  "limpiar-spam",
  "monetizar",
  "retener",
  "soporte",
] as const;

/** One of the canonical owner objective slugs. */
export type OwnerObjective = (typeof OWNER_OBJECTIVES)[number];

/**
 * Progress toward a single objective. `objective` is a slug (usually one of
 * OWNER_OBJECTIVES, but any string is accepted and rendered verbatim if
 * unknown). `current` and `target` are plain counts; `target <= 0` is treated
 * as "no meaningful goal" and yields 0 percent.
 */
export interface ObjectiveProgress {
  readonly objective: string;
  readonly current: number;
  readonly target: number;
}

/** User-facing labels (with accents) for the canonical objectives. */
const OBJECTIVE_LABELS: Readonly<Record<OwnerObjective, string>> = {
  crecer: "Crecer la comunidad",
  "limpiar-spam": "Limpiar el spam",
  monetizar: "Monetización",
  retener: "Retención",
  soporte: "Soporte",
};

const isOwnerObjective = (value: string): value is OwnerObjective =>
  (OWNER_OBJECTIVES as readonly string[]).includes(value);

/** Returns the user-facing label for an objective slug (with accents). */
export const objectiveLabel = (objective: string): string =>
  isOwnerObjective(objective) ? OBJECTIVE_LABELS[objective] : objective;

/**
 * Completion percentage (integer, clamped to 0..100) for one objective.
 * Returns 0 when `target <= 0` (avoids division by zero) and never goes
 * negative even if `current` is negative. Pure and deterministic.
 */
export const objectivePercent = (progress: ObjectiveProgress): number => {
  const { current, target } = progress;
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  const raw = (current / target) * 100;
  if (raw <= 0) {
    return 0;
  }
  if (raw >= 100) {
    return 100;
  }
  return Math.round(raw);
};

const BAR_SLOTS = 10;

/** Builds a fixed-width progress bar, e.g. `"███░░░░░░░"` for 30%. */
const objectiveBar = (percent: number): string => {
  const filled = Math.round((percent / 100) * BAR_SLOTS);
  const clamped = filled < 0 ? 0 : filled > BAR_SLOTS ? BAR_SLOTS : filled;
  return "█".repeat(clamped) + "░".repeat(BAR_SLOTS - clamped);
};

/**
 * Renders a user-facing (Spanish, with accents) summary of objective progress,
 * one line per objective with a label, a bar and the percentage. Returns a
 * friendly placeholder when the list is empty. Pure and deterministic.
 */
export const formatObjectives = (
  progress: readonly ObjectiveProgress[],
): string => {
  if (progress.length === 0) {
    return "🎯 Aún no hay objetivos configurados.";
  }
  const lines = progress.map((item) => {
    const percent = objectivePercent(item);
    return `• ${objectiveLabel(item.objective)}: ${objectiveBar(percent)} ${percent}%`;
  });
  return `🎯 Objetivos del propietario:\n${lines.join("\n")}`;
};
