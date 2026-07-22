import { describe, expect, it } from "vitest";
import { prioritizeActions } from "./critical-priority.js";

describe("prioritizeActions", () => {
  it("prioritizes by kind descending", () => {
    expect(
      prioritizeActions([
        { id: "1", kind: "warn" },
        { id: "2", kind: "ban" },
        { id: "3", kind: "mute" },
      ]),
    ).toEqual([
      { id: "2", priority: 3 },
      { id: "3", priority: 2 },
      { id: "1", priority: 1 },
    ]);
  });

  it("treats raid as top priority", () => {
    expect(prioritizeActions([{ id: "r", kind: "raid" }])[0]?.priority).toBe(3);
  });

  it("assigns unknown kinds priority zero", () => {
    expect(prioritizeActions([{ id: "x", kind: "hug" }])).toEqual([
      { id: "x", priority: 0 },
    ]);
  });

  it("breaks priority ties by id ascending", () => {
    expect(
      prioritizeActions([
        { id: "b", kind: "ban" },
        { id: "a", kind: "ban" },
      ]),
    ).toEqual([
      { id: "a", priority: 3 },
      { id: "b", priority: 3 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(prioritizeActions([])).toEqual([]);
  });
});
