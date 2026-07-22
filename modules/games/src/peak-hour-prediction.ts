/**
 * The busiest hour and its activity value. peakHour is -1 for an empty series.
 * Pure and deterministic.
 */
export interface PeakHourResult {
  readonly peakHour: number;
  readonly peakValue: number;
}

/**
 * Finds the hour with the most activity from a per-hour series (index = hour).
 * On ties the earliest hour wins. An empty series yields peakHour -1 and
 * peakValue 0. Pure and deterministic.
 */
export const findPeakHour = (
  activityByHour: readonly number[],
): PeakHourResult => {
  let peakHour = -1;
  let peakValue = 0;
  for (let hour = 0; hour < activityByHour.length; hour += 1) {
    const value = activityByHour[hour] ?? 0;
    if (peakHour === -1 || value > peakValue) {
      peakHour = hour;
      peakValue = value;
    }
  }
  return { peakHour, peakValue };
};
