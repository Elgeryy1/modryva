/**
 * Input for topic-misuse detection: the message text plus the keyword sets
 * that define what belongs in this topic and what signals an off-topic
 * message. Pure and deterministic.
 */
export interface TopicMisuseInput {
  readonly text: string;
  readonly topicKeywords: readonly string[];
  readonly offTopicKeywords: readonly string[];
}

/**
 * Result of a topic-misuse check: whether the message looks off-topic for the
 * topic and which off-topic keywords matched. Pure and deterministic.
 */
export interface TopicMisuseResult {
  readonly misused: boolean;
  readonly hits: readonly string[];
}

/** Lowercases and strips diacritics for accent-insensitive matching. */
const foldTopicText = (value: string): string =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Detects a message posted in the wrong topic: it contains at least one
 * off-topic keyword and none of the topic's own keywords. Matching is case-
 * and accent-insensitive. Returns the matched off-topic keywords in
 * offTopicKeywords order, deduplicated. Pure and deterministic.
 */
export const detectTopicMisuse = (
  input: TopicMisuseInput,
): TopicMisuseResult => {
  const haystack = foldTopicText(input.text);
  const onTopic = input.topicKeywords.some((keyword) =>
    haystack.includes(foldTopicText(keyword)),
  );
  const hits: string[] = [];
  for (const keyword of input.offTopicKeywords) {
    if (haystack.includes(foldTopicText(keyword)) && !hits.includes(keyword)) {
      hits.push(keyword);
    }
  }
  return { misused: hits.length > 0 && !onTopic, hits };
};
