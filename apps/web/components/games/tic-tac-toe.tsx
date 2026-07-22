"use client";

import { useState } from "react";

type Cell = "X" | "O" | null;
type Outcome = "win" | "draw" | "lose";

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

const winnerOf = (board: readonly Cell[]): Cell => {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return mark;
    }
  }
  return null;
};

const emptyCells = (board: readonly Cell[]): number[] =>
  board.flatMap((cell, index) => (cell === null ? [index] : []));

const randomOf = (cells: readonly number[], fallback: number): number =>
  cells.length > 0
    ? (cells[Math.floor(Math.random() * cells.length)] ?? fallback)
    : fallback;

/**
 * Beatable "medium" AI: take an immediate win, else block the player's
 * immediate win, else prefer the center, then a corner, then any free cell. A
 * careful player can always force at least a draw — which keeps the game fun
 * instead of futile (a perfect minimax opponent never loses).
 */
const chooseAiMove = (board: readonly Cell[]): number => {
  const cells = emptyCells(board);
  for (const index of cells) {
    const trial = [...board];
    trial[index] = "O";
    if (winnerOf(trial) === "O") {
      return index;
    }
  }
  for (const index of cells) {
    const trial = [...board];
    trial[index] = "X";
    if (winnerOf(trial) === "X") {
      return index;
    }
  }
  if (cells.includes(4)) {
    return 4;
  }
  const corners = cells.filter((index) => index % 2 === 0);
  return corners.length > 0
    ? randomOf(corners, cells[0] ?? 0)
    : randomOf(cells, 0);
};

const glyph = (cell: Cell): string =>
  cell === "X" ? "❌" : cell === "O" ? "⭕" : "";

const newBoard = (): Cell[] => Array.from({ length: 9 }, () => null);

/**
 * Tres en raya versus a beatable CPU. The player is ❌ and always moves first.
 * Raw score: win 3 / draw 1 / loss 0 (maps to 0..3 leaderboard points).
 */
export function TicTacToe({
  onFinish,
}: {
  onFinish: (rawScore: number) => void;
}) {
  const [board, setBoard] = useState<Cell[]>(newBoard);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Tú eres ❌ — te toca");

  const settle = (finalBoard: Cell[], outcome: Outcome) => {
    setBoard(finalBoard);
    setBusy(true);
    setStatus(
      outcome === "win"
        ? "¡Ganaste! 🎉"
        : outcome === "draw"
          ? "Empate 🤝"
          : "Perdiste 😅",
    );
    const raw = outcome === "win" ? 3 : outcome === "draw" ? 1 : 0;
    setTimeout(() => onFinish(raw), 950);
  };

  const play = (index: number) => {
    if (busy || board[index] !== null) {
      return;
    }
    const afterPlayer = [...board];
    afterPlayer[index] = "X";
    if (winnerOf(afterPlayer) === "X") {
      settle(afterPlayer, "win");
      return;
    }
    if (emptyCells(afterPlayer).length === 0) {
      settle(afterPlayer, "draw");
      return;
    }

    setBoard(afterPlayer);
    setBusy(true);
    setStatus("Modryva piensa…");
    setTimeout(() => {
      const afterAi = [...afterPlayer];
      afterAi[chooseAiMove(afterPlayer)] = "O";
      if (winnerOf(afterAi) === "O") {
        settle(afterAi, "lose");
        return;
      }
      if (emptyCells(afterAi).length === 0) {
        settle(afterAi, "draw");
        return;
      }
      setBoard(afterAi);
      setBusy(false);
      setStatus("Tú eres ❌ — te toca");
    }, 420);
  };

  return (
    <div className="game">
      <p className="game-progress">{status}</p>
      <div className="ttt-board">
        {board.map((cell, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3x3 board, cells never reorder
            key={index}
            type="button"
            className="ttt-cell"
            disabled={busy || cell !== null}
            onClick={() => play(index)}
          >
            {glyph(cell)}
          </button>
        ))}
      </div>
    </div>
  );
}
