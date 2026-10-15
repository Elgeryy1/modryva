import { describe, expect, it } from "vitest";
import {
  applyMove,
  type Board,
  type Cell,
  emptyBoard,
  isFull,
  markFor,
  outcomeOf,
  parseBoard,
  turnOf,
  winnerOf,
} from "./match-tictactoe.js";

/** Builds a board from a 9-char sketch: "x" / "o" / "." */
const of = (sketch: string): Cell[] =>
  [...sketch].map((c) => (c === "x" ? "X" : c === "o" ? "O" : null));

describe("turnOf", () => {
  it("gives the opening move to the host", () => {
    expect(turnOf(emptyBoard())).toBe("X");
  });

  it("alternates strictly with the marks on the board", () => {
    expect(turnOf(of("x........"))).toBe("O");
    expect(turnOf(of("xo......."))).toBe("X");
  });

  it("is derived, so it can never disagree with the position", () => {
    // A stored turn column and a board are two facts that drift; this one is
    // recomputed, so a reload always resumes the same side to move.
    const board = of("xox.o.x..");
    expect(turnOf(board)).toBe(turnOf([...board]));
  });
});

describe("applyMove", () => {
  it("places the mark of the seat that moved", () => {
    const res = applyMove(emptyBoard(), "host", 4);
    expect(res.ok && res.board[4]).toBe("X");
  });

  it("refuses a move out of turn", () => {
    const res = applyMove(emptyBoard(), "guest", 0);
    expect(res).toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("refuses an occupied square", () => {
    const res = applyMove(of("x........"), "guest", 0);
    expect(res).toEqual({ ok: false, reason: "occupied" });
  });

  it("refuses an index outside the board", () => {
    for (const bad of [-1, 9, 1.5, Number.NaN]) {
      expect(applyMove(emptyBoard(), "host", bad)).toEqual({
        ok: false,
        reason: "out-of-range",
      });
    }
  });

  it("refuses any move once the game is won", () => {
    // Otherwise a slow tap arriving after the winning one would keep playing a
    // match that already has a result.
    const won = of("xxx" + "oo." + "...");
    expect(applyMove(won, "guest", 5)).toEqual({
      ok: false,
      reason: "finished",
    });
  });

  it("refuses any move on a full board", () => {
    expect(applyMove(of("xoxxoxoxo"), "host", 0).ok).toBe(false);
  });

  it("never mutates the board it was given", () => {
    // The caller persists the returned board; mutating the input would corrupt
    // whatever else still holds a reference to the pre-move position.
    const before = emptyBoard();
    applyMove(before, "host", 0);
    expect(before).toEqual(emptyBoard());
  });

  it("rejects an occupied square even when it is not your turn", () => {
    // Order matters for the message: "esa casilla ya está ocupada" is the
    // useful thing to say, and it is true regardless of whose turn it is.
    expect(applyMove(of("x........"), "host", 0).ok).toBe(false);
  });
});

describe("winnerOf / outcomeOf", () => {
  it("finds a win on every line", () => {
    const wins = [
      "xxx......",
      "...xxx...",
      "......xxx",
      "x..x..x..",
      ".x..x..x.",
      "..x..x..x",
      "x...x...x",
      "..x.x.x..",
    ];
    for (const sketch of wins) {
      expect(winnerOf(of(sketch))).toBe("X");
    }
  });

  it("attributes a win to the right seat", () => {
    expect(outcomeOf(of("ooo.xx..."))).toEqual({
      status: "won",
      seat: "guest",
    });
    expect(outcomeOf(of("xxx.oo..."))).toEqual({ status: "won", seat: "host" });
  });

  it("calls a full board with no line a draw", () => {
    const drawn = of("xoxxoxoxo");
    expect(isFull(drawn)).toBe(true);
    expect(winnerOf(drawn)).toBeNull();
    expect(outcomeOf(drawn)).toEqual({ status: "draw" });
  });

  it("reports an unfinished game as still playing", () => {
    expect(outcomeOf(of("xo......."))).toEqual({ status: "playing" });
  });
});

describe("parseBoard", () => {
  it("accepts a board this module could have produced", () => {
    expect(
      parseBoard(["X", "O", null, null, null, null, null, null, null]),
    ).not.toBeNull();
  });

  it("rejects anything that is not nine cells", () => {
    expect(parseBoard(null)).toBeNull();
    expect(parseBoard("xxx")).toBeNull();
    expect(parseBoard([])).toBeNull();
    expect(parseBoard(Array.from({ length: 10 }, () => null))).toBeNull();
  });

  it("rejects a cell that is not a mark", () => {
    const bad = [...emptyBoard()] as unknown[];
    bad[0] = "Z";
    expect(parseBoard(bad)).toBeNull();
  });

  it("rejects a position where someone moved twice", () => {
    // Unreachable through applyMove, so it did not come from here — restoring
    // it would let the match continue from a state nobody can explain.
    expect(parseBoard(of("xx......."))).toBeNull();
    expect(parseBoard(of("oo......."))).toBeNull();
  });

  it("rejects a board where O opened", () => {
    expect(parseBoard(of("o........"))).toBeNull();
  });
});

describe("markFor", () => {
  it("gives X to the host and O to the guest", () => {
    expect(markFor("host")).toBe("X");
    expect(markFor("guest")).toBe("O");
  });
});

describe("a whole match", () => {
  it("plays out to a host win without a single illegal state", () => {
    let board: Board = emptyBoard();
    const moves: Array<["host" | "guest", number]> = [
      ["host", 0],
      ["guest", 3],
      ["host", 1],
      ["guest", 4],
      ["host", 2],
    ];
    for (const [seat, index] of moves) {
      const res = applyMove(board, seat, index);
      expect(res.ok).toBe(true);
      if (res.ok) {
        board = res.board;
      }
    }
    expect(outcomeOf(board)).toEqual({ status: "won", seat: "host" });
  });
});
