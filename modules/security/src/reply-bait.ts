/**
 * Input signals for the reply-bait heuristic. Every field is a plain value the
 * caller extracts from an incoming Telegram message and the message it replies
 * to, so the detector never touches Telegram/domain types directly.
 */
export interface ReplyBaitInput {
  /** Whether the incoming message is a reply to another message. */
  readonly isReply: boolean;
  /** Reaction count on the replied-to message (0 when unknown). */
  readonly repliedMessageReactions: number;
  /** Age of the replying account in milliseconds. */
  readonly replierAccountAgeMs: number;
  /** Whether the reply text contains a link (http, t.me, and similar). */
  readonly textHasLink: boolean;
  /** Whether the reply text contains an @mention. */
  readonly textHasMention: boolean;
}

/**
 * Result of the reply-bait heuristic. `score` counts how many signals fired,
 * `reasons` lists the human-readable Spanish reasons in a fixed order, and
 * `suspicious` is true once the score reaches the suspicious threshold.
 */
export interface ReplyBaitAssessment {
  /** True when `score` reaches the suspicious threshold. */
  readonly suspicious: boolean;
  /** Number of triggered signals (equals `reasons.length`). */
  readonly score: number;
  /** Triggered reasons in fixed order: popular reply, new account, link, mention. */
  readonly reasons: readonly string[];
}

/** Replied-to messages with strictly more reactions than this are "popular". */
const POPULAR_REACTION_THRESHOLD = 20;

/** Accounts younger than this many milliseconds (7 days) count as "new". */
const NEW_ACCOUNT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum score at which a message is flagged as suspicious. */
const SUSPICIOUS_SCORE = 2;

/**
 * Scores an incoming reply for "reply-bait": often-new accounts that reply to
 * popular messages to gain visibility, sneaking in a link or a mention. Each
 * triggered signal adds one point and one reason, always appended in the fixed
 * order (popular reply, new account, link, mention), so the output is stable
 * for a given input. Flags `suspicious` once the score reaches SUSPICIOUS_SCORE.
 * The popular-reply signal only fires when the message is actually a reply.
 * Pure and deterministic.
 */
export const assessReplyBait = (input: ReplyBaitInput): ReplyBaitAssessment => {
  const reasons: string[] = [];
  if (
    input.isReply &&
    input.repliedMessageReactions > POPULAR_REACTION_THRESHOLD
  ) {
    reasons.push("🔥 Respondió a un mensaje popular");
  }
  if (input.replierAccountAgeMs < NEW_ACCOUNT_MAX_AGE_MS) {
    reasons.push("🆕 Cuenta nueva");
  }
  if (input.textHasLink) {
    reasons.push("🔗 Incluye un enlace");
  }
  if (input.textHasMention) {
    reasons.push("📣 Incluye una mención");
  }
  const score = reasons.length;
  return { suspicious: score >= SUSPICIOUS_SCORE, score, reasons };
};
