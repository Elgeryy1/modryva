import { describe, expect, it } from "vitest";
import { summarizeClientHistory } from "./client-history.js";

describe("summarizeClientHistory", () => {
  it("counts tickets grouped by status", () => {
    expect(
      summarizeClientHistory([
        { status: "abierto" },
        { status: "abierto" },
        { status: "resuelto" },
        { status: "cerrado" },
      ]),
    ).toEqual({ total: 4, open: 2, resolved: 1, closed: 1 });
  });

  it("returns all-zero counts for an empty array", () => {
    expect(summarizeClientHistory([])).toEqual({
      total: 0,
      open: 0,
      resolved: 0,
      closed: 0,
    });
  });

  it("returns all-zero counts for undefined", () => {
    expect(summarizeClientHistory(undefined)).toEqual({
      total: 0,
      open: 0,
      resolved: 0,
      closed: 0,
    });
  });

  it("counts a single open ticket", () => {
    expect(summarizeClientHistory([{ status: "abierto" }])).toEqual({
      total: 1,
      open: 1,
      resolved: 0,
      closed: 0,
    });
  });

  it("counts a single resolved ticket", () => {
    expect(summarizeClientHistory([{ status: "resuelto" }])).toEqual({
      total: 1,
      open: 0,
      resolved: 1,
      closed: 0,
    });
  });

  it("counts a single closed ticket", () => {
    expect(summarizeClientHistory([{ status: "cerrado" }])).toEqual({
      total: 1,
      open: 0,
      resolved: 0,
      closed: 1,
    });
  });

  it("keeps total equal to the sum of the three status counts", () => {
    const summary = summarizeClientHistory([
      { status: "cerrado" },
      { status: "cerrado" },
      { status: "resuelto" },
      { status: "abierto" },
      { status: "abierto" },
      { status: "abierto" },
    ]);
    expect(summary.total).toBe(
      summary.open + summary.resolved + summary.closed,
    );
    expect(summary).toEqual({ total: 6, open: 3, resolved: 1, closed: 2 });
  });

  it("is deterministic and order-independent for equal multisets", () => {
    const a = summarizeClientHistory([
      { status: "abierto" },
      { status: "cerrado" },
      { status: "resuelto" },
    ]);
    const b = summarizeClientHistory([
      { status: "resuelto" },
      { status: "abierto" },
      { status: "cerrado" },
    ]);
    expect(a).toEqual(b);
    expect(a).toEqual({ total: 3, open: 1, resolved: 1, closed: 1 });
  });
});
