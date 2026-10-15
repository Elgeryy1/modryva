/**
 * Input for a single energy-spend attempt when a user plays a game.
 * `current` is the energy the user has now, `cost` is what the action
 * requires, and `max` is the ceiling the balance can never exceed.
 * Pure and deterministic.
 */
export interface EnergySpendInput {
  readonly current: number;
  readonly cost: number;
  readonly max: number;
}

/**
 * Outcome of an energy-spend attempt. `allowed` reports whether the action
 * could be paid for; `remaining` is the resulting balance, always clamped to
 * the inclusive range [0, max].
 * Pure and deterministic.
 */
export interface EnergySpendResult {
  readonly allowed: boolean;
  readonly remaining: number;
}

/**
 * Clamps a value into the inclusive range [0, upper], treating a negative
 * upper bound as 0 so the range is never inverted. Internal helper.
 * Pure and deterministic.
 */
const clampToBudget = (value: number, upper: number): number => {
  const top = upper < 0 ? 0 : upper;
  if (value < 0) {
    return 0;
  }
  if (value > top) {
    return top;
  }
  return value;
};

/**
 * Attempts to spend energy for a game action, limiting farming and abuse.
 * The action is allowed only when the cost is non-negative and the user can
 * afford it (current >= cost). When allowed, the cost is subtracted; otherwise
 * the balance is left untouched. The returned balance is always clamped into
 * [0, max], so an over-cap or negative starting balance is normalized.
 * Pure and deterministic.
 */
export const spendEnergy = (input: EnergySpendInput): EnergySpendResult => {
  const { current, cost, max } = input;
  const allowed = cost >= 0 && current >= cost;
  const rawRemaining = allowed ? current - cost : current;
  return { allowed, remaining: clampToBudget(rawRemaining, max) };
};
