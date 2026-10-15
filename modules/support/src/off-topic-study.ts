/**
 * Input for off-topic-during-study detection: the current hour and the message
 * text. Pure and deterministic.
 */
export interface OffTopicStudyInput {
  readonly hourOfDay: number;
  readonly text: string;
}

/** Options for detectOffTopicStudy. */
export interface OffTopicStudyOptions {
  readonly studyStart?: number;
  readonly studyEnd?: number;
  readonly offTopicKeywords?: readonly string[];
}

/**
 * Result: whether the message is flagged as off-topic during study hours and
 * which keywords matched. Pure and deterministic.
 */
export interface OffTopicStudyResult {
  readonly flagged: boolean;
  readonly hits: readonly string[];
}

const DEFAULT_OFF_TOPIC_STUDY_KEYWORDS: readonly string[] = [
  "meme",
  "broma",
  "juego",
  "fiesta",
];

/** Lowercases and strips diacritics for accent-insensitive matching. */
const foldStudyText = (value: string): string =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Flags messages that drift off-topic during study hours. Study hours are the
 * half-open range [studyStart, studyEnd) (defaults 9..18). During those hours a
 * message hitting any off-topic keyword (default meme, broma, juego, fiesta) is
 * flagged. Matching is case- and accent-insensitive; hits preserve keyword
 * order, deduplicated. Pure and deterministic.
 */
export const detectOffTopicStudy = (
  input: OffTopicStudyInput,
  options?: OffTopicStudyOptions,
): OffTopicStudyResult => {
  const studyStart = options?.studyStart ?? 9;
  const studyEnd = options?.studyEnd ?? 18;
  const keywords =
    options?.offTopicKeywords ?? DEFAULT_OFF_TOPIC_STUDY_KEYWORDS;
  const inStudyHours =
    input.hourOfDay >= studyStart && input.hourOfDay < studyEnd;
  const haystack = foldStudyText(input.text);
  const hits: string[] = [];
  for (const keyword of keywords) {
    if (haystack.includes(foldStudyText(keyword)) && !hits.includes(keyword)) {
      hits.push(keyword);
    }
  }
  return { flagged: inStudyHours && hits.length > 0, hits };
};
