/**
 * Read-only snapshot of what an owner might care about right now.
 * Counts are non-negative; negative or fractional values are normalized.
 */
export interface OwnerSummaryState {
  /** Number of appeals awaiting the owner's decision. */
  readonly pendingAppeals: number;
  /** Number of currently open incidents. */
  readonly openIncidents: number;
  /** Number of members that joined recently. */
  readonly newMembers: number;
}

/** Normalizes a raw count to a non-negative integer. Pure and deterministic. */
const normalizeCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Builds one "N cosa" fragment picking singular or plural. Pure and deterministic. */
const fragment = (count: number, singular: string, plural: string): string => {
  return `${count} ${count === 1 ? singular : plural}`;
};

/**
 * Builds an ultra-short, one-line Spanish summary for the owner in
 * "solo dime lo importante" mode. Only non-zero essentials are listed,
 * joined by a middle dot and always in the order appeals, incidents, members.
 * When nothing needs attention it returns a calm all-clear line.
 * Pure and deterministic.
 */
export const buildOwnerSummary = (state: OwnerSummaryState): string => {
  const appeals = normalizeCount(state.pendingAppeals);
  const incidents = normalizeCount(state.openIncidents);
  const members = normalizeCount(state.newMembers);

  const parts: string[] = [];
  if (appeals > 0) {
    parts.push(
      fragment(appeals, "apelación pendiente", "apelaciones pendientes"),
    );
  }
  if (incidents > 0) {
    parts.push(
      fragment(incidents, "incidencia abierta", "incidencias abiertas"),
    );
  }
  if (members > 0) {
    parts.push(fragment(members, "miembro nuevo", "miembros nuevos"));
  }

  if (parts.length === 0) {
    return "✅ Todo en orden, nada urgente por ahora.";
  }
  return `📋 Lo importante: ${parts.join(" · ")}`;
};
