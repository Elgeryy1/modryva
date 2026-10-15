/** A single appeal tied to the incident it disputes. Pure and deterministic. */
export interface IncidentAppeal {
  readonly incidentId: string;
  readonly userId: number;
}

/**
 * Appeals grouped under one incident: the distinct sorted users who appealed
 * and the total appeal count. Pure and deterministic.
 */
export interface AppealIncidentGroup {
  readonly incidentId: string;
  readonly userIds: readonly number[];
  readonly count: number;
}

/**
 * Groups appeals by incident. Each group lists its distinct appealing users
 * sorted ascending and the total number of appeals (including repeats from the
 * same user). Groups are sorted by count descending, then incidentId ascending.
 * Pure and deterministic.
 */
export const bucketAppealsByIncident = (
  appeals: readonly IncidentAppeal[],
): readonly AppealIncidentGroup[] => {
  const byIncident = new Map<string, { users: Set<number>; count: number }>();
  for (const appeal of appeals) {
    const entry = byIncident.get(appeal.incidentId);
    if (entry === undefined) {
      byIncident.set(appeal.incidentId, {
        users: new Set([appeal.userId]),
        count: 1,
      });
    } else {
      entry.users.add(appeal.userId);
      entry.count += 1;
    }
  }
  const groups: AppealIncidentGroup[] = [];
  for (const [incidentId, entry] of byIncident) {
    groups.push({
      incidentId,
      userIds: [...entry.users].sort((a, b) => a - b),
      count: entry.count,
    });
  }
  return groups.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.incidentId < b.incidentId
      ? -1
      : a.incidentId > b.incidentId
        ? 1
        : 0;
  });
};
