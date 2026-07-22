/**
 * Options for a rule cooldown check.
 * Pure and deterministic.
 */
export interface RuleCooldownOptions {
  /** Cooldown window in milliseconds. Defaults to DEFAULT_COOLDOWN_MS. */
  readonly cooldownMs?: number;
}

/**
 * Result of a rule cooldown check.
 * Pure and deterministic.
 */
export interface RuleCooldownResult {
  /** Whether the rule action is allowed to fire again now. */
  readonly allowed: boolean;
  /** Milliseconds left before the action is allowed again; 0 when allowed. */
  readonly remainingMs: number;
}

/** Default cooldown window: one minute. Pure and deterministic. */
export const DEFAULT_COOLDOWN_MS = 60000;

/**
 * Decides whether a rule action may fire again given when it last fired.
 * The action is allowed when it never fired (lastFiredMs undefined) or when
 * at least cooldownMs has elapsed since it last fired. remainingMs is the
 * non-negative wait left before the next allowed fire (0 when allowed or
 * never fired). A negative cooldownMs is treated as 0. Time is supplied via
 * nowMs so no clock is read inside. Pure and deterministic.
 */
export const checkRuleCooldown = (
  lastFiredMs: number | undefined,
  nowMs: number,
  options?: RuleCooldownOptions,
): RuleCooldownResult => {
  const rawCooldown = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cooldownMs = rawCooldown > 0 ? rawCooldown : 0;
  if (lastFiredMs === undefined) {
    return { allowed: true, remainingMs: 0 };
  }
  const elapsed = nowMs - lastFiredMs;
  if (elapsed >= cooldownMs) {
    return { allowed: true, remainingMs: 0 };
  }
  const remaining = cooldownMs - elapsed;
  return { allowed: false, remainingMs: remaining > 0 ? remaining : 0 };
};
