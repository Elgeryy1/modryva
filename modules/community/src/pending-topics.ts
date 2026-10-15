/**
 * A single agenda item captured from a chat conversation: the topic label and
 * whether it has already been marked as resolved. Plain data shape.
 */
export interface TopicItem {
  readonly topic: string;
  readonly resolved: boolean;
}

/**
 * True when the topic label has visible, non-whitespace content.
 * Pure and deterministic.
 */
const isMeaningful = (topic: string): boolean => topic.trim().length > 0;

/**
 * Returns the distinct topics that still need attention. A topic qualifies when
 * it has at least one unresolved item AND no resolved item anywhere in the list.
 * Blank or whitespace-only topics are ignored. First-appearance order is
 * preserved (the result is never sorted), and duplicates are collapsed.
 * Pure and deterministic.
 */
export const extractPendingTopics = (
  items: readonly TopicItem[],
): readonly string[] => {
  const resolvedTopics = new Set<string>();
  for (const item of items) {
    if (item.resolved && isMeaningful(item.topic)) {
      resolvedTopics.add(item.topic);
    }
  }
  const pending: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.resolved || !isMeaningful(item.topic)) {
      continue;
    }
    const topic = item.topic;
    if (resolvedTopics.has(topic) || seen.has(topic)) {
      continue;
    }
    seen.add(topic);
    pending.push(topic);
  }
  return pending;
};

/**
 * Builds a Spanish reminder message for the pending topics, adapting the copy
 * to zero, one, or many topics. Callers should pass the output of
 * extractPendingTopics. Pure and deterministic.
 */
export const formatPendingReminder = (topics: readonly string[]): string => {
  if (topics.length === 0) {
    return "✅ No quedaron temas pendientes de ayer.";
  }
  if (topics.length === 1) {
    const only = topics[0] ?? "";
    return `⏳ Ayer quedó sin resolver: ${only}`;
  }
  const lines = topics.map((topic) => `• ${topic}`).join("\n");
  return `📌 Ayer quedaron sin resolver estos temas:\n${lines}`;
};
