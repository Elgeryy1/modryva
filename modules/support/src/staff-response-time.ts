/**
 * A single recorded staff response, pairing the staff member id with how many
 * milliseconds they took to reply. Negative responseMs values are treated as
 * invalid and ignored by computeStaffResponseTimes. Pure and deterministic.
 */
export interface StaffResponseSample {
  readonly staffId: number;
  readonly responseMs: number;
}

/**
 * Aggregated average response time for one staff member: the count of valid
 * samples and the mean responseMs rounded to the nearest integer. Pure and
 * deterministic.
 */
export interface StaffResponseTime {
  readonly staffId: number;
  readonly avgMs: number;
  readonly count: number;
}

interface StaffAccumulator {
  total: number;
  count: number;
}

/**
 * Computes the average response time per staff member. Ignores samples with a
 * negative responseMs, and omits staff whose only samples were all invalid.
 * avgMs is rounded to the nearest integer. Results are sorted by avgMs
 * ascending, breaking ties by staffId ascending. Pure and deterministic.
 */
export const computeStaffResponseTimes = (
  responses: readonly StaffResponseSample[],
): readonly StaffResponseTime[] => {
  const byStaff = new Map<number, StaffAccumulator>();
  for (const sample of responses) {
    if (sample.responseMs < 0) {
      continue;
    }
    const current = byStaff.get(sample.staffId) ?? { total: 0, count: 0 };
    current.total += sample.responseMs;
    current.count += 1;
    byStaff.set(sample.staffId, current);
  }

  const rows: StaffResponseTime[] = [];
  for (const [staffId, acc] of byStaff) {
    if (acc.count === 0) {
      continue;
    }
    rows.push({
      staffId,
      avgMs: Math.round(acc.total / acc.count),
      count: acc.count,
    });
  }

  rows.sort((a, b) =>
    a.avgMs !== b.avgMs ? a.avgMs - b.avgMs : a.staffId - b.staffId,
  );
  return rows;
};
