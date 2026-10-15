/**
 * A single scheduled task with a title and an absolute due time in
 * milliseconds since the Unix epoch.
 */
export interface DeadlineTask {
  /** Human-readable task name shown to the user (e.g. "Examen de mates"). */
  readonly title: string;
  /** Absolute due time in milliseconds since the Unix epoch. */
  readonly dueMs: number;
}

/**
 * A task whose deadline is approaching, together with how long remains
 * until it is due, expressed in milliseconds.
 */
export interface SoonReminder {
  /** The task title. */
  readonly title: string;
  /** Milliseconds remaining until the task is due (always >= 0). */
  readonly inMs: number;
}

/**
 * The result of classifying a list of tasks against the current instant:
 * titles already past due, and upcoming tasks within the "soon" window.
 */
export interface DeadlineReminders {
  /** Titles of tasks whose due time is strictly in the past, in input order. */
  readonly overdue: readonly string[];
  /** Upcoming tasks within the soon window, sorted by inMs ascending. */
  readonly soon: readonly SoonReminder[];
}

/** Options that tune how deadline reminders are computed. */
export interface DeadlineReminderOptions {
  /**
   * Length of the "soon" window in milliseconds. A task counts as soon when
   * 0 <= dueMs - nowMs <= soonMs. Defaults to 24 hours.
   */
  readonly soonMs?: number;
}

/** Default soon window: twenty-four hours expressed in milliseconds. */
const DEFAULT_SOON_MS = 86_400_000;

/**
 * Classifies tasks relative to nowMs into overdue titles and upcoming
 * "soon" reminders. A task is overdue when dueMs < nowMs. A task is soon
 * when 0 <= dueMs - nowMs <= soonMs (default 24h). The overdue list keeps
 * input order; the soon list is sorted by remaining time ascending, ties
 * keeping input order (stable). Tasks further out than the window are
 * omitted from both lists.
 * Pure and deterministic.
 */
export const computeDeadlineReminders = (
  tasks: readonly DeadlineTask[],
  nowMs: number,
  options?: DeadlineReminderOptions,
): DeadlineReminders => {
  const soonMs = options?.soonMs ?? DEFAULT_SOON_MS;
  const overdue: string[] = [];
  const soon: SoonReminder[] = [];
  for (const task of tasks) {
    const inMs = task.dueMs - nowMs;
    if (inMs < 0) {
      overdue.push(task.title);
    } else if (inMs <= soonMs) {
      soon.push({ title: task.title, inMs });
    }
  }
  soon.sort((a, b) => a.inMs - b.inMs);
  return { overdue, soon };
};
