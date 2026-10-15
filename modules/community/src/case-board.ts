/**
 * Kanban board logic for the case engine's MiniApp view. Pure and
 * deterministic: it maps case statuses to fixed board columns, orders each
 * column by priority (then age), and counts cases per column. No I/O, no
 * clock; callers pass plain case snapshots (including precomputed ageMs).
 */

/** The four fixed board columns, in left-to-right display order. */
export const CASE_BOARD_COLUMNS = [
  "nuevo",
  "en-curso",
  "esperando",
  "resuelto",
] as const;

/** One of the four board columns. */
export type CaseColumn = (typeof CASE_BOARD_COLUMNS)[number];

/** Priority of a case, from lowest to highest urgency. */
export type CasePriority = "low" | "normal" | "high";

/**
 * A plain case snapshot as seen by the board. `ageMs` is precomputed by the
 * caller (e.g. `nowMs - createdAtMs`) so this module stays clock-free.
 */
export interface BoardCase {
  readonly id: string;
  readonly status: string;
  readonly priority: CasePriority;
  readonly ageMs: number;
}

/**
 * Maps a raw case status to its board column. Recognized statuses map to their
 * column; anything unknown (including empty) falls back to "nuevo" so no case
 * is ever dropped from the board. Case-insensitive and trimmed.
 */
export const caseColumn = (c: BoardCase): CaseColumn => {
  const status = c.status.trim().toLowerCase();
  switch (status) {
    case "nuevo":
    case "new":
    case "abierto":
    case "open":
      return "nuevo";
    case "en-curso":
    case "en_curso":
    case "in-progress":
    case "in_progress":
    case "progreso":
      return "en-curso";
    case "esperando":
    case "waiting":
    case "pausado":
    case "on-hold":
      return "esperando";
    case "resuelto":
    case "resolved":
    case "cerrado":
    case "closed":
    case "done":
      return "resuelto";
    default:
      return "nuevo";
  }
};

const PRIORITY_RANK: Readonly<Record<CasePriority, number>> = {
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Comparator for two cases within a column: higher priority first, then older
 * (larger ageMs) first. Ties keep a stable order. Pure and deterministic.
 */
const compareBoardCases = (a: BoardCase, b: BoardCase): number => {
  const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (byPriority !== 0) {
    return byPriority;
  }
  return b.ageMs - a.ageMs;
};

const emptyBoard = (): Record<CaseColumn, BoardCase[]> => ({
  nuevo: [],
  "en-curso": [],
  esperando: [],
  resuelto: [],
});

/**
 * Buckets cases into their board columns and orders each column by priority
 * (desc) then age (desc). Returns a record with all four columns present (empty
 * arrays when no case lands there). The input is not mutated. Deterministic.
 */
export const orderBoard = (
  cases: readonly BoardCase[],
): Record<CaseColumn, BoardCase[]> => {
  const board = emptyBoard();
  for (const c of cases) {
    board[caseColumn(c)].push(c);
  }
  for (const column of CASE_BOARD_COLUMNS) {
    board[column].sort(compareBoardCases);
  }
  return board;
};

/**
 * Counts how many cases land in each board column. Returns a record with all
 * four columns present (0 when empty). Pure and deterministic.
 */
export const boardCounts = (
  cases: readonly BoardCase[],
): Record<CaseColumn, number> => {
  const counts: Record<CaseColumn, number> = {
    nuevo: 0,
    "en-curso": 0,
    esperando: 0,
    resuelto: 0,
  };
  for (const c of cases) {
    counts[caseColumn(c)] += 1;
  }
  return counts;
};
