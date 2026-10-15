import { describe, expect, it } from "vitest";
import { rankReportedBugs } from "./bug-ranking.js";

describe("rankReportedBugs", () => {
  it("tallies reports per bugId and sorts by count descending", () => {
    expect(
      rankReportedBugs([
        { bugId: "b1", title: "Crash al abrir" },
        { bugId: "b2", title: "Boton roto" },
        { bugId: "b1", title: "Crash al abrir de nuevo" },
        { bugId: "b1", title: "Otro crash" },
        { bugId: "b2", title: "Boton roto otra vez" },
      ]),
    ).toEqual([
      { bugId: "b1", title: "Crash al abrir", count: 3 },
      { bugId: "b2", title: "Boton roto", count: 2 },
    ]);
  });

  it("uses the title from the first occurrence of each bugId", () => {
    expect(
      rankReportedBugs([
        { bugId: "x", title: "primero" },
        { bugId: "x", title: "segundo" },
      ]),
    ).toEqual([{ bugId: "x", title: "primero", count: 2 }]);
  });

  it("breaks count ties by bugId ascending", () => {
    expect(
      rankReportedBugs([
        { bugId: "zeta", title: "z" },
        { bugId: "alpha", title: "a" },
        { bugId: "mid", title: "m" },
      ]),
    ).toEqual([
      { bugId: "alpha", title: "a", count: 1 },
      { bugId: "mid", title: "m", count: 1 },
      { bugId: "zeta", title: "z", count: 1 },
    ]);
  });

  it("orders by count first, then bugId within equal counts", () => {
    expect(
      rankReportedBugs([
        { bugId: "b", title: "b" },
        { bugId: "b", title: "b" },
        { bugId: "c", title: "c" },
        { bugId: "c", title: "c" },
        { bugId: "a", title: "a" },
      ]),
    ).toEqual([
      { bugId: "b", title: "b", count: 2 },
      { bugId: "c", title: "c", count: 2 },
      { bugId: "a", title: "a", count: 1 },
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(rankReportedBugs([])).toEqual([]);
  });

  it("handles a single report", () => {
    expect(rankReportedBugs([{ bugId: "only", title: "unico" }])).toEqual([
      { bugId: "only", title: "unico", count: 1 },
    ]);
  });

  it("treats distinct bugIds separately even with identical titles", () => {
    expect(
      rankReportedBugs([
        { bugId: "b1", title: "mismo" },
        { bugId: "b2", title: "mismo" },
      ]),
    ).toEqual([
      { bugId: "b1", title: "mismo", count: 1 },
      { bugId: "b2", title: "mismo", count: 1 },
    ]);
  });

  it("preserves empty-string titles from the first occurrence", () => {
    expect(
      rankReportedBugs([
        { bugId: "e", title: "" },
        { bugId: "e", title: "no usado" },
      ]),
    ).toEqual([{ bugId: "e", title: "", count: 2 }]);
  });

  it("is deterministic regardless of input arrival order", () => {
    const a = rankReportedBugs([
      { bugId: "b1", title: "uno" },
      { bugId: "b2", title: "dos" },
      { bugId: "b1", title: "uno-again" },
    ]);
    const b = rankReportedBugs([
      { bugId: "b1", title: "uno-again" },
      { bugId: "b1", title: "uno" },
      { bugId: "b2", title: "dos" },
    ]);
    expect(a.map((r) => ({ bugId: r.bugId, count: r.count }))).toEqual(
      b.map((r) => ({ bugId: r.bugId, count: r.count })),
    );
  });
});
