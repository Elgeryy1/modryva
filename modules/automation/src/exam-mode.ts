/**
 * Categories that get silenced while exam/class mode is active:
 * games, memes and links. Pure and deterministic.
 */
const EXAM_MODE_BLOCKED: readonly string[] = ["juegos", "memes", "enlaces"];

/** Default first hour (inclusive) of the exam/class window. Pure and deterministic. */
const DEFAULT_EXAM_START = 8;

/** Default last hour (exclusive) of the exam/class window. Pure and deterministic. */
const DEFAULT_EXAM_END = 14;

/**
 * Optional custom exam/class window, expressed as whole hours of the day.
 * `start` is inclusive, `end` is exclusive. Both default to 8..14.
 */
export interface ExamModeSchedule {
  readonly start?: number;
  readonly end?: number;
}

/**
 * Result describing whether exam/class mode is active at a given hour and,
 * if so, which content categories must be silenced.
 */
export interface ExamModeRules {
  readonly active: boolean;
  readonly blocked: readonly string[];
}

/** Returns true when `hour` is a whole number in the 0..23 range. Pure and deterministic. */
const isValidHour = (hour: number): boolean =>
  Number.isInteger(hour) && hour >= 0 && hour <= 23;

/**
 * Decides whether `hour` falls inside the half-open window [start, end).
 * Supports overnight windows where start > end (e.g. 20..6). When start === end
 * the window is considered empty. Pure and deterministic.
 */
const isWithinWindow = (hour: number, start: number, end: number): boolean => {
  if (start === end) {
    return false;
  }
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
};

/**
 * Computes the exam/class automation rules for a given hour of the day.
 * During the active window [start, end) it reports the blocked categories
 * ("juegos", "memes", "enlaces"); otherwise it reports no restrictions.
 * Defaults to the 8..14 window. Invalid hours are treated as inactive.
 * Pure and deterministic.
 */
export const rulesForExamMode = (
  hourOfDay: number,
  options?: ExamModeSchedule,
): ExamModeRules => {
  if (!isValidHour(hourOfDay)) {
    return { active: false, blocked: [] };
  }
  const start = options?.start ?? DEFAULT_EXAM_START;
  const end = options?.end ?? DEFAULT_EXAM_END;
  if (!isValidHour(start) || !isValidHour(end)) {
    return { active: false, blocked: [] };
  }
  const active = isWithinWindow(hourOfDay, start, end);
  return active
    ? { active: true, blocked: [...EXAM_MODE_BLOCKED] }
    : { active: false, blocked: [] };
};
