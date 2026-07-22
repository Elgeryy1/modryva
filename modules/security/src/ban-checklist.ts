/**
 * Input flags for the pre-ban checklist. Each flag answers one due-diligence
 * question a moderator must clear before banning a member.
 */
export interface BanChecklistInput {
  /** Whether concrete evidence (messages, media, logs) is attached. */
  readonly hasEvidence: boolean;
  /** Whether the member is a confirmed repeat offender. */
  readonly isRepeatOffender: boolean;
  /** Whether the specific violated rule has been cited. */
  readonly ruleCited: boolean;
  /** Whether a ban duration (temporary or permanent) has been set. */
  readonly durationSet: boolean;
}

/**
 * A single checklist line: a user-facing Spanish label plus its done state.
 */
export interface BanChecklistItem {
  /** User-facing Spanish label shown to the moderator. */
  readonly label: string;
  /** Whether this check is satisfied. */
  readonly done: boolean;
}

/**
 * Full pre-ban checklist outcome: the four ordered items, whether every item
 * is done (ready to ban), and how many items are still pending.
 */
export interface BanChecklist {
  /** True only when all four items are done. */
  readonly ready: boolean;
  /** The four checklist items in a fixed, deterministic order. */
  readonly items: readonly BanChecklistItem[];
  /** Count of items still not done (0 to 4). */
  readonly pendingCount: number;
}

/**
 * Builds the pre-ban due-diligence checklist from the four input flags.
 * Items always appear in a fixed order (evidencia, reincidencia, regla,
 * duracion). "ready" is true only when every item is done. "pendingCount"
 * is the number of items still missing. Pure and deterministic.
 */
export const buildBanChecklist = (input: BanChecklistInput): BanChecklist => {
  const items: readonly BanChecklistItem[] = [
    { label: "Evidencia adjunta", done: input.hasEvidence },
    { label: "Reincidencia verificada", done: input.isRepeatOffender },
    { label: "Regla violada citada", done: input.ruleCited },
    { label: "Duración definida", done: input.durationSet },
  ];
  let pendingCount = 0;
  for (const item of items) {
    if (!item.done) {
      pendingCount += 1;
    }
  }
  return { ready: pendingCount === 0, items, pendingCount };
};
