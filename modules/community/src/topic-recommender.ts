/**
 * Topic recommender: given a message text and the keyword profiles of the
 * chat topics, suggest which topic the conversation belongs to so a moderator
 * can move it there. Pure detection only; the actual move lives in the service.
 *
 * Matching is keyword-based over normalized text (lowercased, diacritics
 * stripped, non-alphanumeric collapsed to spaces). A topic scores one point per
 * distinct keyword whose normalized form appears as a whole word (or contiguous
 * word phrase) in the normalized text. The highest score wins; ties keep the
 * first topic in input order; a zero score yields null.
 */

/** A chat topic and the keywords that characterize it. */
export interface TopicProfile {
  readonly topicId: string;
  readonly keywords: readonly string[];
}

/** A topic suggestion: the winning topic id and its keyword-match score. */
export interface TopicRecommendation {
  readonly topicId: string;
  readonly score: number;
}

/**
 * Normalizes a string for matching: lowercases, strips diacritics, and
 * collapses every run of non-alphanumeric characters to a single space, with a
 * single leading and trailing space so whole-word checks are simple substring
 * checks. Pure and deterministic.
 */
const normalize = (value: string): string => {
  const stripped = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return stripped.length > 0 ? ` ${stripped} ` : "";
};

/**
 * Counts how many distinct keywords of a topic match the already-normalized
 * text. A keyword matches when its normalized form is a non-empty whole-word
 * (or word-phrase) substring of the text. Duplicate keywords count once. Pure
 * and deterministic.
 */
const scoreTopic = (
  normalizedText: string,
  keywords: readonly string[],
): number => {
  const matched = new Set<string>();
  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword.length === 0 || matched.has(normalizedKeyword)) {
      continue;
    }
    if (normalizedText.includes(normalizedKeyword)) {
      matched.add(normalizedKeyword);
    }
  }
  return matched.size;
};

/**
 * Recommends the topic whose keywords best match the text. Returns the winning
 * topic id with its score (count of distinct matched keywords), or null when no
 * keyword of any topic matches. Ties are broken by input order (first wins).
 * Pure and deterministic.
 */
export const recommendTopic = (
  text: string,
  topics: readonly TopicProfile[],
): TopicRecommendation | null => {
  const normalizedText = normalize(text);
  if (normalizedText.length === 0) {
    return null;
  }

  let best: TopicRecommendation | null = null;
  for (const topic of topics) {
    const score = scoreTopic(normalizedText, topic.keywords);
    if (score > 0 && (best === null || score > best.score)) {
      best = { topicId: topic.topicId, score };
    }
  }

  return best;
};
