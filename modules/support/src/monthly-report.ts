/**
 * Owner monthly report for a Modryva-managed group: renders the current month
 * counters and, when a previous month is provided, a comparison block plus the
 * per-metric deltas. Pure logic (no I/O, clock or randomness): every value is
 * derived from the plain inputs, so the same inputs always yield the same text.
 */

/**
 * Aggregated counters for a single month. All fields are plain integers the
 * caller has already summed from persistence; this module never touches Prisma.
 */
export interface MonthStats {
  readonly actions: number;
  readonly spam: number;
  readonly newMembers: number;
  readonly lostMembers: number;
}

/**
 * Net member change for the month: nuevos - bajas. Can be negative when the
 * group shrank. Pure and deterministic.
 */
export const monthlyNetGrowth = (stats: MonthStats): number =>
  stats.newMembers - stats.lostMembers;

/**
 * Formats a signed integer for the user: `"+5"` for positive, `"-3"` for
 * negative (the minus comes from the number itself) and `"±0"` for zero. Used
 * for growth and comparison lines. Pure and deterministic.
 */
export const formatMonthlyDelta = (n: number): string =>
  n > 0 ? `+${n}` : n < 0 ? `${n}` : "±0";

/**
 * Builds the owner monthly report. Returns the user-facing `text` and a
 * `deltas` map (current - previous) keyed by the MonthStats field names. When
 * `previous` is omitted the report shows only the current month and `deltas` is
 * an empty object, so callers can render the first month safely. Pure and
 * deterministic.
 */
export const buildMonthlyReport = (
  current: MonthStats,
  previous?: MonthStats,
): { text: string; deltas: Record<string, number> } => {
  const net = monthlyNetGrowth(current);

  const lines: string[] = [
    "📊 Informe mensual",
    "",
    `🛡️ Acciones de moderación: ${current.actions}`,
    `🚫 Spam bloqueado: ${current.spam}`,
    `🎉 Nuevos miembros: ${current.newMembers}`,
    `👋 Bajas: ${current.lostMembers}`,
    `📈 Crecimiento neto: ${formatMonthlyDelta(net)}`,
  ];

  if (previous === undefined) {
    return { text: lines.join("\n"), deltas: {} };
  }

  const dActions = current.actions - previous.actions;
  const dSpam = current.spam - previous.spam;
  const dNew = current.newMembers - previous.newMembers;
  const dLost = current.lostMembers - previous.lostMembers;

  lines.push(
    "",
    "Comparación con el mes anterior:",
    `🛡️ Acciones: ${formatMonthlyDelta(dActions)}`,
    `🚫 Spam: ${formatMonthlyDelta(dSpam)}`,
    `🎉 Nuevos: ${formatMonthlyDelta(dNew)}`,
    `👋 Bajas: ${formatMonthlyDelta(dLost)}`,
  );

  return {
    text: lines.join("\n"),
    deltas: {
      actions: dActions,
      spam: dSpam,
      newMembers: dNew,
      lostMembers: dLost,
    },
  };
};
