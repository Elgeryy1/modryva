/**
 * A single message observed in a group, tagged with the topic it was posted in.
 * Pure data, no behavior.
 */
export interface CrosspostingMessage {
  readonly topicId: number;
  readonly text: string;
}

/**
 * Options for detectCrossposting.
 * minTopics: minimum number of DISTINCT topics a text must span to be flagged
 * as internal crossposting (default 2, clamped to a floor of 1).
 */
export interface CrosspostingOptions {
  readonly minTopics?: number;
}

/**
 * One detected crossposted text: the original sample (first occurrence) and the
 * sorted list of distinct topics it appeared in.
 */
export interface CrosspostingDuplicate {
  readonly sample: string;
  readonly topics: readonly number[];
}

/**
 * Result of a crossposting scan: whether anything matched and the flagged texts.
 */
export interface CrosspostingReport {
  readonly matched: boolean;
  readonly duplicates: readonly CrosspostingDuplicate[];
}

/**
 * Normalizes a message text for grouping: trims, lowercases and collapses runs
 * of whitespace into a single space. Internal helper.
 * Pure and deterministic.
 */
const normalizeCrosspostText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Detects internal crossposting: the same message posted across several topics.
 * Groups messages by normalized text (case-insensitive, whitespace-collapsed),
 * counts DISTINCT topics per group, and flags any group spanning at least
 * minTopics topics. Blank/whitespace-only texts are ignored. Within each
 * duplicate, topics are sorted ascending; duplicates are sorted by topic count
 * descending, then by sample ascending, for a stable deterministic order.
 * Pure and deterministic.
 */
export const detectCrossposting = (
  messages: readonly CrosspostingMessage[],
  options?: CrosspostingOptions,
): CrosspostingReport => {
  const requested = options?.minTopics ?? 2;
  const minTopics = requested < 1 ? 1 : requested;

  const groups = new Map<string, { sample: string; topics: number[] }>();
  for (const message of messages) {
    const key = normalizeCrosspostText(message.text);
    if (key.length === 0) {
      continue;
    }
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        sample: message.text.trim(),
        topics: [message.topicId],
      });
    } else if (!existing.topics.includes(message.topicId)) {
      existing.topics.push(message.topicId);
    }
  }

  const duplicates: CrosspostingDuplicate[] = [];
  for (const group of groups.values()) {
    if (group.topics.length >= minTopics) {
      const topics = [...group.topics].sort((a, b) => a - b);
      duplicates.push({ sample: group.sample, topics });
    }
  }

  duplicates.sort((a, b) => {
    if (b.topics.length !== a.topics.length) {
      return b.topics.length - a.topics.length;
    }
    if (a.sample < b.sample) {
      return -1;
    }
    if (a.sample > b.sample) {
      return 1;
    }
    return 0;
  });

  return { matched: duplicates.length > 0, duplicates };
};
