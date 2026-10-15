/**
 * A single day of group activity: how many messages were sent and how many
 * of them were flagged as conflicts (fights, insults, heated exchanges).
 */
export interface DailyActivity {
  readonly messages: number;
  readonly conflicts: number;
}

/**
 * Coarse trend of a group day compared to the previous one.
 * - "tenso": more conflicts than yesterday.
 * - "tranquilo": fewer conflicts, or same conflicts with fewer messages.
 * - "movido": same conflicts but more messages.
 * - "igual": identical conflicts and messages.
 */
export type StatsTrend = "tenso" | "tranquilo" | "movido" | "igual";

const TREND_SENTENCES: Record<StatsTrend, string> = {
  tenso: "Hoy el grupo estuvo más tenso que ayer. 😬",
  tranquilo: "Hoy el grupo estuvo más tranquilo que ayer. 😌",
  movido: "Hoy el grupo estuvo más movido que ayer. 🔥",
  igual: "Hoy el grupo estuvo igual que ayer. 😐",
};

/**
 * Classifies today's group activity against yesterday's. Conflicts are the
 * primary axis (they define tension); when conflicts tie, message volume
 * breaks the tie. Returns a stable StatsTrend for the same inputs.
 * Pure and deterministic.
 */
export const classifyDailyTrend = (
  today: DailyActivity,
  yesterday: DailyActivity,
): StatsTrend => {
  if (today.conflicts > yesterday.conflicts) {
    return "tenso";
  }
  if (today.conflicts < yesterday.conflicts) {
    return "tranquilo";
  }
  if (today.messages > yesterday.messages) {
    return "movido";
  }
  if (today.messages < yesterday.messages) {
    return "tranquilo";
  }
  return "igual";
};

/**
 * Produces one user-facing Spanish sentence describing how today's group
 * activity compares to yesterday's, based on classifyDailyTrend.
 * Pure and deterministic.
 */
export const humanizeDailyStats = (
  today: DailyActivity,
  yesterday: DailyActivity,
): string => {
  const trend = classifyDailyTrend(today, yesterday);
  return TREND_SENTENCES[trend];
};
