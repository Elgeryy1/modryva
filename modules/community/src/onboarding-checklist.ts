/**
 * State of a member's first steps in a community: whether they have read the
 * rules, introduced themselves, and picked their interests.
 * Pure and deterministic.
 */
export interface FirstStepsState {
  readonly readRules: boolean;
  readonly introduced: boolean;
  readonly pickedInterests: boolean;
}

/**
 * A single onboarding step with its user-facing label and completion flag.
 * Pure and deterministic.
 */
export interface FirstStepsChecklistItem {
  readonly label: string;
  readonly done: boolean;
}

/**
 * Rendered "Mis primeros pasos" checklist: the ordered steps plus a flag that
 * is true only when every step is done.
 * Pure and deterministic.
 */
export interface FirstStepsChecklist {
  readonly complete: boolean;
  readonly items: readonly FirstStepsChecklistItem[];
}

/**
 * Builds the "Mis primeros pasos" onboarding checklist from a member state.
 * Always returns three steps in a fixed order (rules, introduction,
 * interests); complete is true only when all three steps are done.
 * Pure and deterministic.
 */
export const buildFirstStepsChecklist = (
  state: FirstStepsState,
): FirstStepsChecklist => {
  const items: readonly FirstStepsChecklistItem[] = [
    { label: "Lee las reglas del grupo 📜", done: state.readRules },
    { label: "Preséntate a la comunidad 👋", done: state.introduced },
    { label: "Elige tus intereses ✨", done: state.pickedInterests },
  ];
  const complete = items.every((item) => item.done);
  return { complete, items };
};
