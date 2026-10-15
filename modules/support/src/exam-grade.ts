/**
 * A single answered question: what the student gave and the correct value.
 * Pure and deterministic.
 */
export interface ExamAnswer {
  readonly given: string;
  readonly correct: string;
}

/**
 * Graded outcome of a mini exam: raw score, total questions, integer percent
 * and whether it passed (>= 50%). Pure and deterministic.
 */
export interface ExamResult {
  readonly score: number;
  readonly total: number;
  readonly percent: number;
  readonly passed: boolean;
}

/** Trims and lowercases an answer for lenient comparison. */
const normalizeAnswer = (value: string): string => value.trim().toLowerCase();

/**
 * Grades a mini exam by comparing each given answer to its correct value,
 * trimmed and case-insensitive. The percent is rounded to an integer; an empty
 * exam scores 0% and does not pass. Passing requires at least 50%.
 * Pure and deterministic.
 */
export const gradeExam = (answers: readonly ExamAnswer[]): ExamResult => {
  const total = answers.length;
  let score = 0;
  for (const answer of answers) {
    if (normalizeAnswer(answer.given) === normalizeAnswer(answer.correct)) {
      score += 1;
    }
  }
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return { score, total, percent, passed: percent >= 50 };
};
