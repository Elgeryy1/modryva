import { describe, expect, it } from "vitest";
import {
  canUndo,
  pushUndo,
  UNDO_DEFAULT_WINDOW_MS,
  type UndoableAction,
} from "./undo-stack.js";

const action = (overrides: Partial<UndoableAction> = {}): UndoableAction => ({
  id: "a",
  ms: 0,
  ...overrides,
});

describe("UNDO_DEFAULT_WINDOW_MS", () => {
  it("is 30 seconds in milliseconds", () => {
    expect(UNDO_DEFAULT_WINDOW_MS).toBe(30_000);
  });
});

describe("canUndo", () => {
  it("is true right after the action (zero elapsed)", () => {
    expect(canUndo(action({ ms: 1_000 }), 1_000, UNDO_DEFAULT_WINDOW_MS)).toBe(
      true,
    );
  });

  it("is true partway through the window", () => {
    expect(canUndo(action({ ms: 0 }), 10_000, UNDO_DEFAULT_WINDOW_MS)).toBe(
      true,
    );
  });

  it("is true exactly at the window boundary", () => {
    expect(canUndo(action({ ms: 0 }), 30_000, UNDO_DEFAULT_WINDOW_MS)).toBe(
      true,
    );
  });

  it("is false one millisecond past the window", () => {
    expect(canUndo(action({ ms: 0 }), 30_001, UNDO_DEFAULT_WINDOW_MS)).toBe(
      false,
    );
  });

  it("is false for actions dated in the future (negative elapsed)", () => {
    expect(canUndo(action({ ms: 5_000 }), 4_000, UNDO_DEFAULT_WINDOW_MS)).toBe(
      false,
    );
  });

  it("honours a custom window", () => {
    expect(canUndo(action({ ms: 0 }), 5_000, 5_000)).toBe(true);
    expect(canUndo(action({ ms: 0 }), 5_001, 5_000)).toBe(false);
  });

  it("makes every past action non-undoable with a zero window", () => {
    expect(canUndo(action({ ms: 0 }), 0, 0)).toBe(true);
    expect(canUndo(action({ ms: 0 }), 1, 0)).toBe(false);
  });

  it("treats a negative window as never undoable for past actions", () => {
    expect(canUndo(action({ ms: 0 }), 1, -1)).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const a = action({ ms: 100 });
    expect(canUndo(a, 200, 500)).toBe(canUndo(a, 200, 500));
  });
});

describe("pushUndo", () => {
  it("prepends the action, most recent first", () => {
    const first = action({ id: "1", ms: 1 });
    const second = action({ id: "2", ms: 2 });
    expect(pushUndo([first], second, 10)).toEqual([second, first]);
  });

  it("pushes onto an empty stack", () => {
    const only = action({ id: "1", ms: 1 });
    expect(pushUndo([], only, 10)).toEqual([only]);
  });

  it("drops the oldest entry from the tail when exceeding maxSize", () => {
    const a = action({ id: "a", ms: 1 });
    const b = action({ id: "b", ms: 2 });
    const c = action({ id: "c", ms: 3 });
    expect(pushUndo([b, a], c, 2)).toEqual([c, b]);
  });

  it("keeps exactly maxSize entries", () => {
    const stack: readonly UndoableAction[] = [
      action({ id: "b", ms: 2 }),
      action({ id: "a", ms: 1 }),
    ];
    const result = pushUndo(stack, action({ id: "c", ms: 3 }), 2);
    expect(result).toHaveLength(2);
  });

  it("returns an empty stack when maxSize is 0", () => {
    expect(
      pushUndo([action({ id: "1", ms: 1 })], action({ id: "2", ms: 2 }), 0),
    ).toEqual([]);
  });

  it("returns an empty stack when maxSize is negative", () => {
    expect(pushUndo([], action({ id: "1", ms: 1 }), -5)).toEqual([]);
  });

  it("does not mutate the input stack", () => {
    const original = action({ id: "1", ms: 1 });
    const stack: readonly UndoableAction[] = [original];
    pushUndo(stack, action({ id: "2", ms: 2 }), 10);
    expect(stack).toEqual([original]);
    expect(stack).toHaveLength(1);
  });

  it("returns a new array reference", () => {
    const stack: readonly UndoableAction[] = [];
    expect(pushUndo(stack, action({ id: "1", ms: 1 }), 10)).not.toBe(stack);
  });

  it("keeps the newest entries when the stack is already full", () => {
    const a = action({ id: "a", ms: 1 });
    const b = action({ id: "b", ms: 2 });
    const c = action({ id: "c", ms: 3 });
    const d = action({ id: "d", ms: 4 });
    expect(pushUndo([c, b, a], d, 3)).toEqual([d, c, b]);
  });
});
