/**
 * One campaign-to-tag rule: users who join through `link` get labeled `tag`.
 * Pure and deterministic.
 */
export interface CampaignRoleRule {
  readonly link: string;
  readonly tag: string;
}

/**
 * Options for tagByCampaign. `fallbackTag` is the label used when no rule
 * matches (defaults to "organico"). Pure and deterministic.
 */
export interface CampaignRoleOptions {
  readonly fallbackTag?: string;
}

const DEFAULT_FALLBACK_TAG = "organico";

/**
 * Resolves the campaign tag for a user given the invite link they joined
 * through. The link is trimmed before comparison and matched exactly (Telegram
 * invite links are case-sensitive). The FIRST matching rule in `mapping` wins,
 * so ordering is stable and deterministic. Returns the configured fallback tag
 * (default "organico") for an undefined, empty, or unmatched link.
 * Pure and deterministic.
 */
export const tagByCampaign = (
  inviteLink: string | undefined,
  mapping: readonly CampaignRoleRule[],
  options?: CampaignRoleOptions,
): string => {
  const fallback = options?.fallbackTag ?? DEFAULT_FALLBACK_TAG;
  if (!inviteLink) {
    return fallback;
  }
  const target = inviteLink.trim();
  if (target.length === 0) {
    return fallback;
  }
  for (const rule of mapping) {
    if (rule.link.trim() === target) {
      return rule.tag;
    }
  }
  return fallback;
};
