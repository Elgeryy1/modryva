/**
 * A single tension observation for the group, bucketed by hour of day.
 * `hourOfDay` must be an integer in 0..23; `tension` is a non-negative
 * intensity score with no personal or diagnostic meaning attached.
 * Pure and deterministic.
 */
export interface TensionEvent {
  readonly hourOfDay: number;
  readonly tension: number;
}

/**
 * Aggregated tension for one hour of the day.
 * `hour` is 0..23, `avgTension` is the mean tension rounded to 2 decimals,
 * and `samples` is how many events fed the average.
 * Pure and deterministic.
 */
export interface HourlyTension {
  readonly hour: number;
  readonly avgTension: number;
  readonly samples: number;
}

/**
 * Rounds a number to at most 2 decimal places, avoiding negative zero.
 * Pure and deterministic.
 */
const round2 = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};

/**
 * Reports whether an hour value is a valid integer hour of the day (0..23).
 * Pure and deterministic.
 */
const isValidHour = (hour: number): boolean =>
  Number.isInteger(hour) && hour >= 0 && hour <= 23;

/**
 * Builds the group tension history by hour of day. Valid events (integer
 * hour 0..23 and finite tension) are averaged per hour; only hours with at
 * least one sample are returned, each avgTension rounded to 2 decimals, and
 * the result is sorted by hour ascending. Invalid events are ignored so a
 * single bad datapoint never poisons the history. No personal diagnostics.
 * Pure and deterministic.
 */
export const computeTensionByHour = (
  events: readonly TensionEvent[],
): readonly HourlyTension[] => {
  const sums = new Map<number, number>();
  const counts = new Map<number, number>();

  for (const event of events) {
    if (!isValidHour(event.hourOfDay) || !Number.isFinite(event.tension)) {
      continue;
    }
    const hour = event.hourOfDay;
    const prevSum = sums.get(hour) ?? 0;
    const prevCount = counts.get(hour) ?? 0;
    sums.set(hour, prevSum + event.tension);
    counts.set(hour, prevCount + 1);
  }

  const result: HourlyTension[] = [];
  for (const [hour, samples] of counts) {
    const total = sums.get(hour) ?? 0;
    result.push({ hour, avgTension: round2(total / samples), samples });
  }

  result.sort((a, b) => a.hour - b.hour);
  return result;
};
