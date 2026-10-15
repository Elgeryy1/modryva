/**
 * Balance entry for a single user in the anti-whale tax calculation.
 * Pure data shape.
 */
export interface WhaleTaxBalance {
  readonly userId: number;
  readonly balance: number;
}

/**
 * Tax charge levied on a single whale user.
 * Pure data shape.
 */
export interface WhaleTaxCharge {
  readonly userId: number;
  readonly tax: number;
}

/**
 * Tuning options for the anti-whale tax.
 * multipleOfMedian: how many times the median a balance may reach untaxed (default 5).
 * taxRate: fraction of the excess above the threshold that is taxed (default 0.1).
 */
export interface WhaleTaxOptions {
  readonly multipleOfMedian?: number;
  readonly taxRate?: number;
}

/**
 * Computes the median of a list of numbers. Returns 0 for an empty list.
 * Uses the average of the two central values for an even count.
 * Pure and deterministic.
 */
const medianOf = (values: readonly number[]): number => {
  const n = values.length;
  if (n === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const lo = sorted[mid - 1] ?? 0;
  const hi = sorted[mid] ?? 0;
  return (lo + hi) / 2;
};

/**
 * Applies a virtual anti-whale tax so the richest users do not drift too far
 * from the rest. Computes the median balance and a threshold of
 * median * multipleOfMedian (default 5). Every balance strictly above the
 * threshold is taxed by round((balance - threshold) * taxRate) (default rate 0.1);
 * only users with a positive tax are returned, sorted by tax descending and
 * then by userId ascending. Empty input yields an empty list.
 * Pure and deterministic.
 */
export const computeWhaleTax = (
  balances: readonly WhaleTaxBalance[],
  options?: WhaleTaxOptions,
): readonly WhaleTaxCharge[] => {
  if (balances.length === 0) {
    return [];
  }
  const multiple = options?.multipleOfMedian ?? 5;
  const rate = options?.taxRate ?? 0.1;
  const threshold = medianOf(balances.map((entry) => entry.balance)) * multiple;
  const charges: WhaleTaxCharge[] = [];
  for (const entry of balances) {
    if (entry.balance > threshold) {
      const tax = Math.round((entry.balance - threshold) * rate);
      if (tax > 0) {
        charges.push({ userId: entry.userId, tax });
      }
    }
  }
  charges.sort((a, b) => b.tax - a.tax || a.userId - b.userId);
  return charges;
};
