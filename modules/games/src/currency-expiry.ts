/**
 * Default time-to-live for a currency grant: 30 days in milliseconds.
 * Avoids infinite hoarding and farming by expiring old grants.
 * Pure and deterministic.
 */
export const DEFAULT_CURRENCY_TTL_MS: number = 30 * 24 * 60 * 60 * 1000;

/**
 * A single dated grant of soft currency awarded to a user.
 * `amount` is the amount granted; `grantedMs` is the epoch time it was awarded.
 * Pure and deterministic.
 */
export interface CurrencyGrant {
  readonly amount: number;
  readonly grantedMs: number;
}

/**
 * Split of currency by expiry status at a given instant.
 * `expired` is the total of grants past their TTL; `active` is the still-valid total.
 * Pure and deterministic.
 */
export interface CurrencyExpiryResult {
  readonly expired: number;
  readonly active: number;
}

/**
 * Options for computeExpiredCurrency. `ttlMs` overrides the default 30-day TTL.
 * Pure and deterministic.
 */
export interface CurrencyExpiryOptions {
  readonly ttlMs?: number;
}

/**
 * Sums a list of dated currency grants into expired and active buckets.
 * A grant is expired when nowMs - grantedMs >= ttlMs (TTL defaults to 30 days).
 * A non-positive ttlMs is normalized to 0, so any grant at or after its grant
 * time counts as expired. Order of grants does not affect the totals.
 * Pure and deterministic.
 */
export const computeExpiredCurrency = (
  grants: readonly CurrencyGrant[],
  nowMs: number,
  options?: CurrencyExpiryOptions,
): CurrencyExpiryResult => {
  const rawTtl = options?.ttlMs ?? DEFAULT_CURRENCY_TTL_MS;
  const ttlMs = rawTtl > 0 ? rawTtl : 0;
  let expired = 0;
  let active = 0;
  for (const grant of grants) {
    if (nowMs - grant.grantedMs >= ttlMs) {
      expired += grant.amount;
    } else {
      active += grant.amount;
    }
  }
  return { expired, active };
};
