/**
 * Single member contribution to the cooperative city build.
 * `resources` is the amount of resources donated by `userId`.
 * Pure and deterministic.
 */
export interface CoopCityContribution {
  readonly userId: number;
  readonly resources: number;
}

/**
 * Aggregated progress of the cooperative city build.
 * `topContributor` is the userId that donated the most resources
 * (ties resolved to the lowest userId), or undefined when there are
 * no contributions.
 * Pure and deterministic.
 */
export interface CoopCityProgress {
  readonly total: number;
  readonly percent: number;
  readonly complete: boolean;
  readonly topContributor: number | undefined;
}

const clampPercent = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
};

/**
 * Computes the cooperative city build progress from every member
 * contribution against a shared `goal`. `total` is the sum of all
 * resources; `percent` is total/goal*100 rounded and clamped to 0..100
 * (0 when goal is not positive); `complete` is true only when goal is
 * positive and total reaches it; `topContributor` is the biggest donor
 * (ties resolved to the lowest userId), undefined for no contributions.
 * Pure and deterministic.
 */
export const computeCoopCityProgress = (
  contributions: readonly CoopCityContribution[],
  goal: number,
): CoopCityProgress => {
  let total = 0;
  let topContributor: number | undefined;
  let topResources = Number.NEGATIVE_INFINITY;

  for (const contribution of contributions) {
    total += contribution.resources;
    const isMore = contribution.resources > topResources;
    const isTieLowerId =
      contribution.resources === topResources &&
      topContributor !== undefined &&
      contribution.userId < topContributor;
    if (topContributor === undefined || isMore || isTieLowerId) {
      topContributor = contribution.userId;
      topResources = contribution.resources;
    }
  }

  const percent = goal > 0 ? clampPercent(Math.round((total / goal) * 100)) : 0;
  const complete = goal > 0 && total >= goal;

  return {
    total,
    percent,
    complete,
    topContributor,
  };
};
