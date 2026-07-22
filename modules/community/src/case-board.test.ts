import { describe, expect, it } from "vitest";
import {
  type BoardCase,
  boardCounts,
  CASE_BOARD_COLUMNS,
  type CaseColumn,
  caseColumn,
  orderBoard,
} from "./case-board.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const boardCase = (overrides: Partial<BoardCase> = {}): BoardCase => ({
  id: "c1",
  status: "nuevo",
  priority: "normal",
  ageMs: 0,
  ...overrides,
});

describe("CASE_BOARD_COLUMNS", () => {
  it("lists the four columns in display order", () => {
    expect(CASE_BOARD_COLUMNS).toEqual([
      "nuevo",
      "en-curso",
      "esperando",
      "resuelto",
    ]);
  });
});

describe("caseColumn", () => {
  it("maps canonical statuses to their column", () => {
    expect(caseColumn(boardCase({ status: "nuevo" }))).toBe("nuevo");
    expect(caseColumn(boardCase({ status: "en-curso" }))).toBe("en-curso");
    expect(caseColumn(boardCase({ status: "esperando" }))).toBe("esperando");
    expect(caseColumn(boardCase({ status: "resuelto" }))).toBe("resuelto");
  });

  it("accepts english and alias statuses", () => {
    expect(caseColumn(boardCase({ status: "open" }))).toBe("nuevo");
    expect(caseColumn(boardCase({ status: "in_progress" }))).toBe("en-curso");
    expect(caseColumn(boardCase({ status: "waiting" }))).toBe("esperando");
    expect(caseColumn(boardCase({ status: "closed" }))).toBe("resuelto");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(caseColumn(boardCase({ status: "  RESUELTO  " }))).toBe("resuelto");
    expect(caseColumn(boardCase({ status: "En-Curso" }))).toBe("en-curso");
  });

  it("falls back to 'nuevo' for unknown or empty statuses", () => {
    expect(caseColumn(boardCase({ status: "spam" }))).toBe("nuevo");
    expect(caseColumn(boardCase({ status: "" }))).toBe("nuevo");
    expect(caseColumn(boardCase({ status: "   " }))).toBe("nuevo");
  });
});

describe("orderBoard", () => {
  it("returns all four columns even when there are no cases", () => {
    expect(orderBoard([])).toEqual({
      nuevo: [],
      "en-curso": [],
      esperando: [],
      resuelto: [],
    });
  });

  it("buckets cases into their columns", () => {
    const a = boardCase({ id: "a", status: "nuevo" });
    const b = boardCase({ id: "b", status: "waiting" });
    const c = boardCase({ id: "c", status: "resolved" });
    const board = orderBoard([a, b, c]);
    expect(board.nuevo).toEqual([a]);
    expect(board.esperando).toEqual([b]);
    expect(board.resuelto).toEqual([c]);
    expect(board["en-curso"]).toEqual([]);
  });

  it("orders a column by priority descending", () => {
    const low = boardCase({ id: "low", priority: "low" });
    const high = boardCase({ id: "high", priority: "high" });
    const normal = boardCase({ id: "normal", priority: "normal" });
    const board = orderBoard([low, high, normal]);
    expect(board.nuevo.map((c) => c.id)).toEqual(["high", "normal", "low"]);
  });

  it("breaks priority ties by age descending (oldest first)", () => {
    const young = boardCase({ id: "young", priority: "high", ageMs: MINUTE });
    const old = boardCase({ id: "old", priority: "high", ageMs: 3 * HOUR });
    const mid = boardCase({ id: "mid", priority: "high", ageMs: HOUR });
    const board = orderBoard([young, old, mid]);
    expect(board.nuevo.map((c) => c.id)).toEqual(["old", "mid", "young"]);
  });

  it("applies priority before age across mixed cases", () => {
    const oldLow = boardCase({
      id: "oldLow",
      priority: "low",
      ageMs: 10 * HOUR,
    });
    const youngHigh = boardCase({
      id: "youngHigh",
      priority: "high",
      ageMs: MINUTE,
    });
    const board = orderBoard([oldLow, youngHigh]);
    expect(board.nuevo.map((c) => c.id)).toEqual(["youngHigh", "oldLow"]);
  });

  it("does not mutate the input array", () => {
    const input: readonly BoardCase[] = [
      boardCase({ id: "a", priority: "low" }),
      boardCase({ id: "b", priority: "high" }),
    ];
    const snapshot = [...input];
    orderBoard(input);
    expect(input).toEqual(snapshot);
    expect(input[0]?.id).toBe("a");
  });

  it("is deterministic for identical inputs", () => {
    const cases = [
      boardCase({ id: "a", status: "nuevo", priority: "high", ageMs: HOUR }),
      boardCase({ id: "b", status: "waiting", priority: "low", ageMs: MINUTE }),
    ];
    expect(orderBoard(cases)).toEqual(orderBoard(cases));
  });
});

describe("boardCounts", () => {
  it("returns zeros for every column when empty", () => {
    expect(boardCounts([])).toEqual({
      nuevo: 0,
      "en-curso": 0,
      esperando: 0,
      resuelto: 0,
    });
  });

  it("counts cases per column including unknown fallbacks", () => {
    const cases = [
      boardCase({ status: "nuevo" }),
      boardCase({ status: "open" }),
      boardCase({ status: "unknown-status" }),
      boardCase({ status: "en-curso" }),
      boardCase({ status: "resolved" }),
    ];
    expect(boardCounts(cases)).toEqual({
      nuevo: 3,
      "en-curso": 1,
      esperando: 0,
      resuelto: 1,
    });
  });

  it("totals match the number of input cases", () => {
    const cases = [
      boardCase({ status: "nuevo" }),
      boardCase({ status: "waiting" }),
      boardCase({ status: "resuelto" }),
      boardCase({ status: "en-curso" }),
    ];
    const counts = boardCounts(cases);
    const total = CASE_BOARD_COLUMNS.reduce(
      (sum, col: CaseColumn) => sum + counts[col],
      0,
    );
    expect(total).toBe(cases.length);
  });
});
