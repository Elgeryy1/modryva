/**
 * Options for announcement pin expiry. When ttlMs is omitted the default
 * seven-day time-to-live is applied.
 * Pure and deterministic.
 */
export interface AnnouncementExpiryOptions {
  readonly ttlMs?: number;
}

/**
 * Default time-to-live for a pinned announcement: 7 days in milliseconds.
 * Pure and deterministic.
 */
export const ANNOUNCEMENT_DEFAULT_TTL_MS: number = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolves the effective ttl, falling back to the default and never allowing
 * a negative value (a negative ttl is clamped to 0 so expiry is immediate).
 * Internal helper. Pure and deterministic.
 */
const resolveTtlMs = (options?: AnnouncementExpiryOptions): number => {
  const raw = options?.ttlMs ?? ANNOUNCEMENT_DEFAULT_TTL_MS;
  return raw < 0 ? 0 : raw;
};

/**
 * Computes the absolute expiry timestamp (ms) at which a pinned announcement
 * should be automatically unpinned: pinnedAtMs + ttlMs.
 * Pure and deterministic.
 */
export const computeAnnouncementExpiry = (
  pinnedAtMs: number,
  options?: AnnouncementExpiryOptions,
): number => {
  return pinnedAtMs + resolveTtlMs(options);
};

/**
 * Decides whether a pinned announcement has reached its expiry and should be
 * unpinned. True when nowMs is at or past the computed expiry timestamp.
 * Pure and deterministic.
 */
export const shouldUnpinAnnouncement = (
  pinnedAtMs: number,
  nowMs: number,
  options?: AnnouncementExpiryOptions,
): boolean => {
  return nowMs >= computeAnnouncementExpiry(pinnedAtMs, options);
};
