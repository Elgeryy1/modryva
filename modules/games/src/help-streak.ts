/**
 * Represents a single day of a member's helping history. A day only counts
 * toward a streak when the member helped and did NOT spam that day.
 * Pure and deterministic.
 */
export interface HelpStreakDay {
  readonly helped: boolean;
  readonly spam?: boolean;
}

/**
 * Result of evaluating a help-streak history: the current trailing streak and
 * the longest streak ever achieved in the history.
 * Pure and deterministic.
 */
export interface HelpStreakResult {
  readonly streak: number;
  readonly best: number;
}

/**
 * A day qualifies for the streak when the member helped and the day was not
 * flagged as spam. Undefined entries never qualify.
 * Pure and deterministic.
 */
const qualifiesForStreak = (day: HelpStreakDay | undefined): boolean =>
  day?.helped === true && day.spam !== true;

/**
 * Computes the current trailing help streak and the best (longest) run of
 * qualifying days anywhere in the history. A day qualifies only when the
 * member helped without spamming. Order is preserved: streak counts backward
 * from the last entry, best scans the whole array left to right.
 * Pure and deterministic.
 */
export const computeHelpStreak = (
  days: readonly HelpStreakDay[],
): HelpStreakResult => {
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    if (qualifiesForStreak(days[i])) {
      run += 1;
      if (run > best) {
        best = run;
      }
    } else {
      run = 0;
    }
  }
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (qualifiesForStreak(days[i])) {
      streak += 1;
    } else {
      break;
    }
  }
  return { streak, best };
};

/**
 * Returns "dia" pluralization helper text for a day count.
 * Pure and deterministic.
 */
const dayWord = (count: number): string => (count === 1 ? "día" : "días");

/**
 * Builds a friendly Spanish reward message for a help-streak result. Announces
 * a record when the current streak matches or beats the best run, otherwise
 * reports current progress. Returns an encouragement when there is no streak.
 * Pure and deterministic.
 */
export const describeHelpStreak = (result: HelpStreakResult): string => {
  if (result.streak <= 0) {
    return "Aún no tienes una racha de ayuda activa. ¡Empieza hoy! 💪";
  }
  if (result.streak >= result.best) {
    return `🔥 ¡Racha récord de ${result.streak} ${dayWord(result.streak)} ayudando! Sigue así.`;
  }
  return `✅ Llevas ${result.streak} ${dayWord(result.streak)} seguidos ayudando. Tu mejor marca es ${result.best}.`;
};
