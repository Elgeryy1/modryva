import { describe, expect, it } from "vitest";
import { rulesForExamMode } from "./exam-mode.js";

describe("rulesForExamMode", () => {
  it("blocks all categories inside the default window", () => {
    expect(rulesForExamMode(10)).toEqual({
      active: true,
      blocked: ["juegos", "memes", "enlaces"],
    });
  });

  it("is active at the inclusive start boundary", () => {
    expect(rulesForExamMode(8)).toEqual({
      active: true,
      blocked: ["juegos", "memes", "enlaces"],
    });
  });

  it("is inactive at the exclusive end boundary", () => {
    expect(rulesForExamMode(14)).toEqual({ active: false, blocked: [] });
  });

  it("is inactive before the default window", () => {
    expect(rulesForExamMode(7)).toEqual({ active: false, blocked: [] });
  });

  it("honors a custom start hour", () => {
    expect(rulesForExamMode(10, { start: 11 })).toEqual({
      active: false,
      blocked: [],
    });
  });

  it("supports overnight windows where start > end", () => {
    expect(rulesForExamMode(20, { start: 20, end: 6 })).toEqual({
      active: true,
      blocked: ["juegos", "memes", "enlaces"],
    });
    expect(rulesForExamMode(3, { start: 20, end: 6 })).toEqual({
      active: true,
      blocked: ["juegos", "memes", "enlaces"],
    });
    expect(rulesForExamMode(10, { start: 20, end: 6 })).toEqual({
      active: false,
      blocked: [],
    });
  });

  it("treats an empty window (start === end) as always inactive", () => {
    expect(rulesForExamMode(9, { start: 9, end: 9 })).toEqual({
      active: false,
      blocked: [],
    });
  });

  it("treats invalid hours as inactive", () => {
    expect(rulesForExamMode(-1)).toEqual({ active: false, blocked: [] });
    expect(rulesForExamMode(24)).toEqual({ active: false, blocked: [] });
    expect(rulesForExamMode(10.5)).toEqual({ active: false, blocked: [] });
    expect(rulesForExamMode(Number.NaN)).toEqual({
      active: false,
      blocked: [],
    });
  });

  it("treats invalid custom bounds as inactive", () => {
    expect(rulesForExamMode(10, { start: -5 })).toEqual({
      active: false,
      blocked: [],
    });
    expect(rulesForExamMode(10, { end: 99 })).toEqual({
      active: false,
      blocked: [],
    });
  });

  it("returns a fresh blocked array so results cannot be mutated", () => {
    const first = rulesForExamMode(10);
    const second = rulesForExamMode(10);
    expect(first.blocked).not.toBe(second.blocked);
    expect(first).toEqual(second);
  });

  it("keeps blocked categories in a stable order", () => {
    expect(rulesForExamMode(9).blocked).toEqual(["juegos", "memes", "enlaces"]);
  });
});
