/**
 * Conecta 4 con autoridad del servidor, para partidas entre dos personas.
 *
 * Mismo criterio que `match-tictactoe`: este modulo es lo UNICO que decide que
 * es una posicion valida, y los clientes solo dibujan lo que diga. Un cliente
 * que sostenga el tablero puede reclamar cualquier tablero.
 *
 * Puro: sin E/S, sin reloj, sin azar. Cada funcion recibe la posicion y
 * devuelve otra nueva; persistirla es cosa de quien llama.
 */

export const COLUMNS = 7;
export const ROWS = 6;
/** Fichas seguidas que ganan. El nombre del juego, basicamente. */
export const IN_A_ROW = 4;

/** Igual que en tres en raya: el asiento, no el color. */
export type Seat = "host" | "guest";
export type Disc = "R" | "Y";
export type Cell = Disc | null;
/** Tablero plano de 42 casillas, indice = fila * COLUMNS + columna, fila 0
 * arriba. Plano y no anidado porque asi viaja como JSON sin sorpresas. */
export type Board = readonly Cell[];

export const HOST_DISC: Disc = "R";
export const GUEST_DISC: Disc = "Y";

export const emptyBoard = (): Cell[] =>
  Array.from({ length: COLUMNS * ROWS }, () => null);

export const discFor = (seat: Seat): Disc =>
  seat === "host" ? HOST_DISC : GUEST_DISC;

const at = (board: Board, row: number, col: number): Cell =>
  row < 0 || row >= ROWS || col < 0 || col >= COLUMNS
    ? null
    : (board[row * COLUMNS + col] ?? null);

/**
 * La fila donde caeria una ficha en esa columna, o null si esta llena.
 *
 * Se busca desde abajo porque la gravedad es la unica regla de colocacion que
 * tiene este juego: quien llama nunca elige fila.
 */
export const landingRow = (board: Board, col: number): number | null => {
  if (col < 0 || col >= COLUMNS) {
    return null;
  }
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (at(board, row, col) === null) {
      return row;
    }
  }
  return null;
};

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal descendente
  [1, -1], // diagonal ascendente
];

/**
 * El color que tiene cuatro en raya, o null.
 *
 * Se recorre el tablero entero en vez de mirar solo la ultima jugada: es una
 * rejilla de 42 casillas, el coste es irrelevante, y hacerlo asi significa que
 * la funcion da la verdad sobre CUALQUIER posicion — incluida una cargada de
 * la base de datos, que es justo cuando no hay "ultima jugada" a mano.
 */
export const winnerOf = (board: Board): Disc | null => {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      const disc = at(board, row, col);
      if (!disc) {
        continue;
      }
      for (const [dr, dc] of DIRECTIONS) {
        let seguidas = 1;
        while (
          seguidas < IN_A_ROW &&
          at(board, row + dr * seguidas, col + dc * seguidas) === disc
        ) {
          seguidas += 1;
        }
        if (seguidas >= IN_A_ROW) {
          return disc;
        }
      }
    }
  }
  return null;
};

export const isFull = (board: Board): boolean =>
  board.every((cell) => cell !== null);

/**
 * A quien le toca, derivado del tablero en vez de guardado.
 *
 * Derivarlo significa que el turno no puede contradecir a la posicion. Un
 * campo "turno" y un tablero son dos hechos que pueden separarse, y cuando lo
 * hacen la partida o se bloquea o deja mover dos veces seguidas. Rojo abre.
 */
export const seatToMove = (board: Board): Seat => {
  let rojas = 0;
  let amarillas = 0;
  for (const cell of board) {
    if (cell === HOST_DISC) {
      rojas += 1;
    } else if (cell === GUEST_DISC) {
      amarillas += 1;
    }
  }
  return rojas <= amarillas ? "host" : "guest";
};

export type MoveError =
  | "not-your-turn"
  | "column-out-of-range"
  | "column-full"
  | "match-over";

export type MoveResult =
  | {
      readonly ok: true;
      readonly board: Cell[];
      readonly finished: boolean;
      /** host | guest | draw, solo cuando `finished`. */
      readonly result: "host" | "guest" | "draw" | null;
    }
  | { readonly ok: false; readonly error: MoveError };

/**
 * Aplica una jugada. Rechaza todo lo que no sea legal, incluido mover fuera de
 * turno: el turno se comprueba AQUI y no en el cliente, porque un boton
 * deshabilitado en pantalla no impide nada a quien mande la peticion a mano.
 */
export const applyMove = (
  board: Board,
  seat: Seat,
  col: number,
): MoveResult => {
  if (winnerOf(board) !== null || isFull(board)) {
    return { ok: false, error: "match-over" };
  }
  if (seatToMove(board) !== seat) {
    return { ok: false, error: "not-your-turn" };
  }
  if (!Number.isInteger(col) || col < 0 || col >= COLUMNS) {
    return { ok: false, error: "column-out-of-range" };
  }
  const row = landingRow(board, col);
  if (row === null) {
    return { ok: false, error: "column-full" };
  }

  const siguiente = [...board];
  siguiente[row * COLUMNS + col] = discFor(seat);

  const ganador = winnerOf(siguiente);
  if (ganador) {
    return {
      ok: true,
      board: siguiente,
      finished: true,
      result: ganador === HOST_DISC ? "host" : "guest",
    };
  }
  if (isFull(siguiente)) {
    return { ok: true, board: siguiente, finished: true, result: "draw" };
  }
  return { ok: true, board: siguiente, finished: false, result: null };
};

const GLYPH: Readonly<Record<"R" | "Y" | "empty", string>> = {
  R: "🔴",
  Y: "🟡",
  empty: "⚪",
};

/** El tablero como texto, para el chat. Con la fila de numeros debajo, que es
 * lo unico que le dice a alguien que columna esta pulsando. */
export const renderBoard = (board: Board): string => {
  const filas: string[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const celdas: string[] = [];
    for (let col = 0; col < COLUMNS; col += 1) {
      const cell = at(board, row, col);
      celdas.push(cell ? GLYPH[cell] : GLYPH.empty);
    }
    filas.push(celdas.join(""));
  }
  filas.push("1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣");
  return filas.join("\n");
};

/** Las columnas donde todavia cabe una ficha. Las llenas no se ofrecen: un
 * boton que solo puede contestar "esa columna esta llena" sobra. */
export const playableColumns = (board: Board): number[] => {
  const columnas: number[] = [];
  for (let col = 0; col < COLUMNS; col += 1) {
    if (landingRow(board, col) !== null) {
      columnas.push(col);
    }
  }
  return columnas;
};

/** Valida un tablero venido de la base de datos antes de fiarse de el. Una
 * fila corrupta debe fallar aqui y no a mitad de una partida. */
export const isValidBoard = (value: unknown): value is Cell[] =>
  Array.isArray(value) &&
  value.length === COLUMNS * ROWS &&
  value.every((cell) => cell === null || cell === "R" || cell === "Y");
