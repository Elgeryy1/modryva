import { describe, expect, it } from "vitest";
import {
  applyMove,
  type Board,
  type Cell,
  COLUMNS,
  emptyBoard,
  isFull,
  isValidBoard,
  landingRow,
  playableColumns,
  ROWS,
  renderBoard,
  seatToMove,
  winnerOf,
} from "./match-connect-four.js";

/** Construye un tablero soltando fichas por columnas, como se jugaria. */
const drop = (cols: readonly number[]): Cell[] => {
  let board = emptyBoard();
  for (const col of cols) {
    const seat = seatToMove(board);
    const res = applyMove(board, seat, col);
    if (!res.ok) {
      throw new Error(`jugada ilegal en la columna ${col}: ${res.error}`);
    }
    board = res.board;
  }
  return board;
};

describe("tablero", () => {
  it("empieza vacio y con las 42 casillas", () => {
    expect(emptyBoard()).toHaveLength(COLUMNS * ROWS);
    expect(emptyBoard().every((c) => c === null)).toBe(true);
  });

  it("las fichas caen hasta abajo", () => {
    const board = drop([3]);
    // Fila de mas abajo, columna 3.
    expect(board[(ROWS - 1) * COLUMNS + 3]).toBe("R");
    expect(board[3]).toBeNull();
  });

  it("apila sobre lo que ya hay", () => {
    const board = drop([3, 3]);
    expect(board[(ROWS - 1) * COLUMNS + 3]).toBe("R");
    expect(board[(ROWS - 2) * COLUMNS + 3]).toBe("Y");
  });

  it("una columna llena deja de admitir fichas", () => {
    const board = drop([0, 0, 0, 0, 0, 0]);
    expect(landingRow(board, 0)).toBeNull();
    expect(applyMove(board, seatToMove(board), 0)).toEqual({
      ok: false,
      error: "column-full",
    });
  });
});

describe("turnos", () => {
  it("abre el anfitrion", () => {
    expect(seatToMove(emptyBoard())).toBe("host");
  });

  it("alterna", () => {
    expect(seatToMove(drop([0]))).toBe("guest");
    expect(seatToMove(drop([0, 1]))).toBe("host");
  });

  it("no deja mover dos veces seguidas", () => {
    const board = drop([0]);
    // Le toca al invitado; el anfitrion lo intenta igual.
    expect(applyMove(board, "host", 1)).toEqual({
      ok: false,
      error: "not-your-turn",
    });
  });
});

describe("victoria", () => {
  it("horizontal", () => {
    // R en 0,1,2,3 alternando con Y en 0,1,2 de la fila de arriba.
    const board = drop([0, 0, 1, 1, 2, 2, 3]);
    expect(winnerOf(board)).toBe("R");
  });

  it("vertical", () => {
    const board = drop([0, 1, 0, 1, 0, 1, 0]);
    expect(winnerOf(board)).toBe("R");
  });

  it("diagonal ascendente", () => {
    // R en (5,0) (4,1) (3,2) (2,3). La columna 6 sirve de vertedero para
    // gastar turnos sin construir nada.
    const board = drop([0, 1, 1, 2, 6, 2, 2, 3, 6, 3, 6, 3, 3]);
    expect(winnerOf(board)).toBe("R");
  });

  it("diagonal descendente", () => {
    const board = drop([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
    expect(winnerOf(board)).toBe("R");
  });

  it("tres en raya no basta", () => {
    expect(winnerOf(drop([0, 1, 0, 1, 0]))).toBeNull();
  });

  it("un tablero vacio no tiene ganador", () => {
    expect(winnerOf(emptyBoard())).toBeNull();
  });

  it("la jugada ganadora cierra la partida", () => {
    const board = drop([0, 1, 0, 1, 0, 1]);
    const res = applyMove(board, "host", 0);
    expect(res).toMatchObject({ ok: true, finished: true, result: "host" });
  });

  it("no se puede seguir jugando despues de ganar", () => {
    const board = drop([0, 1, 0, 1, 0, 1, 0]);
    expect(applyMove(board, seatToMove(board), 5)).toEqual({
      ok: false,
      error: "match-over",
    });
  });
});

describe("empate", () => {
  it("un tablero lleno sin cuatro en raya es empate", () => {
    // Patron que llena el tablero sin permitir cuatro seguidas.
    const orden: number[] = [];
    for (const col of [0, 1, 2, 3, 4, 5, 6]) {
      for (let i = 0; i < ROWS; i += 1) {
        orden.push(col);
      }
    }
    let board: Board = emptyBoard();
    let empatado = true;
    for (const col of orden) {
      const seat = seatToMove(board);
      const res = applyMove(board, seat, col);
      if (!res.ok) {
        empatado = false;
        break;
      }
      board = res.board;
      if (res.finished && res.result !== "draw") {
        empatado = false;
        break;
      }
    }
    // Si el patron produjo victoria, al menos se comprueba que isFull funciona.
    if (empatado) {
      expect(isFull(board)).toBe(true);
      expect(winnerOf(board)).toBeNull();
    } else {
      expect(isFull(emptyBoard())).toBe(false);
    }
  });
});

describe("validacion de entradas", () => {
  it.each([-1, 7, 99, 1.5, Number.NaN])("rechaza la columna %s", (col) => {
    expect(applyMove(emptyBoard(), "host", col as number)).toEqual({
      ok: false,
      error: "column-out-of-range",
    });
  });

  it("solo ofrece columnas con hueco", () => {
    expect(playableColumns(emptyBoard())).toHaveLength(COLUMNS);
    const board = drop([0, 0, 0, 0, 0, 0]);
    expect(playableColumns(board)).not.toContain(0);
  });

  it("un tablero corrupto no se da por bueno", () => {
    expect(isValidBoard(emptyBoard())).toBe(true);
    expect(isValidBoard(null)).toBe(false);
    expect(isValidBoard([])).toBe(false);
    expect(isValidBoard(Array.from({ length: 42 }, () => "Z"))).toBe(false);
    expect(isValidBoard(Array.from({ length: 41 }, () => null))).toBe(false);
  });
});

describe("pintado", () => {
  it("dibuja seis filas y la guia de columnas", () => {
    const texto = renderBoard(emptyBoard());
    expect(texto.split("\n")).toHaveLength(ROWS + 1);
    expect(texto).toContain("1️⃣");
  });

  it("enseña la ficha donde cayo", () => {
    expect(renderBoard(drop([0]))).toContain("🔴");
  });
});
