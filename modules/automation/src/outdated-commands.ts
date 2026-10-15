/**
 * Result of comparing the currently registered bot commands against the
 * set of commands that the bot expects to have registered.
 * Pure and deterministic.
 */
export interface CommandDriftReport {
  /** Expected commands that are NOT currently registered (need adding). */
  readonly missing: readonly string[];
  /** Registered commands that are NO longer expected (need removing). */
  readonly stale: readonly string[];
  /** True when there is no drift: nothing missing and nothing stale. */
  readonly inSync: boolean;
}

/**
 * Deduplicates a list of command names, preserving first-seen order.
 * Pure and deterministic.
 */
const dedupe = (items: readonly string[]): readonly string[] => {
  const seen: string[] = [];
  for (const item of items) {
    if (!seen.includes(item)) {
      seen.push(item);
    }
  }
  return seen;
};

/**
 * Detects drift between the commands actually registered with Telegram
 * (`registered`) and the commands the bot expects to expose (`expected`).
 *
 * - `missing`: expected commands not present in `registered`, in `expected` order.
 * - `stale`: registered commands not present in `expected`, in `registered` order.
 * - `inSync`: true only when both `missing` and `stale` are empty.
 *
 * Comparison is exact (case-sensitive) and both inputs are deduplicated,
 * preserving first-seen order. Empty inputs yield an in-sync report.
 * Pure and deterministic.
 */
export const detectOutdatedCommands = (
  registered: readonly string[],
  expected: readonly string[],
): CommandDriftReport => {
  const uniqueRegistered = dedupe(registered);
  const uniqueExpected = dedupe(expected);

  const missing = uniqueExpected.filter(
    (cmd) => !uniqueRegistered.includes(cmd),
  );
  const stale = uniqueRegistered.filter((cmd) => !uniqueExpected.includes(cmd));

  return { missing, stale, inSync: missing.length === 0 && stale.length === 0 };
};
