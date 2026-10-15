/**
 * Server-authoritative tres en raya, for matches between two real people.
 *
 * The single-player version lives in the web component and owns its own board,
 * which is fine when the only thing at stake is your own score. It stops being
 * fine the moment a second person is playing: a client that holds the board can
 * claim any board. So this module exists to be the ONLY thing that decides what
 * a position is, and the clients merely draw what it says.
 *
 * Pure: no I/O, no clock, no randomness. Every function takes the position and
 * returns a new one; the caller persists it.
 */

/** X always belongs to the player who opened the match, O to whoever joined. */
export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = readonly Cell[];

/** Seat, not mark: "host" opened the match, "guest" accepted it. */
export type Seat = "host" | "guest";

export const HOST_MARK: Mark = "X";
export const GUEST_MARK: Mark = "O";

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const emptyBoard = (): Cell[] => Array.from({ length: 9 }, () => null);

export const markFor = (seat: Seat): Mark =>
  seat === "host" ? HOST_MARK : GUEST_MARK;

/** The mark on a completed line, or null. */
export const winnerOf = (board: Board): Mark | null => {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return mark;
    }
  }
  return null;
};

export const isFull = (board: Board): boolean =>
  board.every((cell) => cell !== null);

/**
 * Whose turn it is, derived from the board rather than stored.
 *
 * Deriving it means the turn can never disagree with the position — a stored
 * "turn" column and a board are two facts that can drift, and when they do the
 * game either deadlocks or lets someone move twice. X opens, so the side to
 * move is simply the one with fewer marks down.
 */
export const turnOf = (board: Board): Mark => {
  const xs = board.filter((c) => c === "X").length;
  const os = board.filter((c) => c === "O").length;
  return xs <= os ? "X" : "O";
};

export type MoveRejection =
  /** The match is over; nothing more can be played. */
  | "finished"
  /** Not this player's turn. */
  | "not-your-turn"
  /** Outside 0..8, or not an integer. */
  | "out-of-range"
  /** That square already has a mark. */
  | "occupied";

export type MoveResult =
  | { readonly ok: true; readonly board: Cell[] }
  | { readonly ok: false; readonly reason: MoveRejection };

/**
 * Applies one move, or explains why it cannot be applied.
 *
 * Every rejection is named rather than collapsed into a boolean: "occupied" and
 * "not-your-turn" mean very different things to the person tapping, and a
 * single false would have the screen say the same unhelpful thing to both.
 */
export const applyMove = (
  board: Board,
  seat: Seat,
  index: number,
): MoveResult => {
  if (winnerOf(board) !== null || isFull(board)) {
    return { ok: false, reason: "finished" };
  }
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { ok: false, reason: "out-of-range" };
  }
  if (board[index] !== null) {
    return { ok: false, reason: "occupied" };
  }
  const mark = markFor(seat);
  if (turnOf(board) !== mark) {
    return { ok: false, reason: "not-your-turn" };
  }
  const next = [...board];
  next[index] = mark;
  return { ok: true, board: next };
};

export type MatchOutcome =
  | { readonly status: "playing" }
  | { readonly status: "won"; readonly seat: Seat }
  | { readonly status: "draw" };

export const outcomeOf = (board: Board): MatchOutcome => {
  const winner = winnerOf(board);
  if (winner !== null) {
    return { status: "won", seat: winner === HOST_MARK ? "host" : "guest" };
  }
  return isFull(board) ? { status: "draw" } : { status: "playing" };
};

/**
 * Reads a board back from storage, refusing anything that is not a legal
 * 9-cell position.
 *
 * Persisted JSON is not trusted input in the security sense, but it IS input
 * that can be stale or hand-edited, and a malformed board reaching the move
 * logic would produce a game nobody can finish or leave. Falling back to an
 * empty board would silently erase a real match, so this returns null and lets
 * the caller decide.
 */
export const parseBoard = (value: unknown): Cell[] | null => {
  if (!Array.isArray(value) || value.length !== 9) {
    return null;
  }
  const cells: Cell[] = [];
  for (const raw of value) {
    if (raw === null || raw === "X" || raw === "O") {
      cells.push(raw);
    } else {
      return null;
    }
  }
  // A position with impossible mark counts (someone moved twice) cannot be
  // reached by applyMove, so it did not come from this module.
  const xs = cells.filter((c) => c === "X").length;
  const os = cells.filter((c) => c === "O").length;
  if (xs - os < 0 || xs - os > 1) {
    return null;
  }
  return cells;
};
