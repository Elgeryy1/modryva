/**
 * Safety level of a moderation action shown as a traffic light:
 * "verde" (safe), "amarillo" (caution), "rojo" (destructive).
 * Pure and deterministic.
 */
export type ActionSafetyLevel = "verde" | "amarillo" | "rojo";

/**
 * Verdict for a moderation action: its traffic-light level and whether the
 * action can be undone. Pure and deterministic.
 */
export interface ActionSafetyVerdict {
  readonly level: ActionSafetyLevel;
  readonly reversible: boolean;
}

/** Destructive, hard-to-undo actions. */
const RED_ACTIONS: ReadonlySet<string> = new Set([
  "ban",
  "purge",
  "delete_all",
  "global_ban",
]);

/** Reversible but impactful actions. */
const YELLOW_ACTIONS: ReadonlySet<string> = new Set(["mute", "kick"]);

/** Safe, low-impact actions. */
const GREEN_ACTIONS: ReadonlySet<string> = new Set(["warn", "note"]);

/**
 * Classifies a moderation action into a traffic-light safety level. Red
 * actions (ban, purge, delete_all, global_ban) are destructive and marked
 * irreversible; yellow actions (mute, kick) are reversible cautions; green
 * actions (warn, note) are safe. The action is trimmed and lowercased before
 * lookup; an unknown action defaults to "amarillo" (reversible) so callers
 * confirm before running it. Pure and deterministic.
 */
export const classifyActionSafety = (action: string): ActionSafetyVerdict => {
  const normalized = action.trim().toLowerCase();
  if (RED_ACTIONS.has(normalized)) {
    return { level: "rojo", reversible: false };
  }
  if (YELLOW_ACTIONS.has(normalized)) {
    return { level: "amarillo", reversible: true };
  }
  if (GREEN_ACTIONS.has(normalized)) {
    return { level: "verde", reversible: true };
  }
  return { level: "amarillo", reversible: true };
};
