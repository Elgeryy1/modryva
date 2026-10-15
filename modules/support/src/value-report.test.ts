import { describe, expect, it } from "vitest";
import {
  buildValueReport,
  computeValueDelta,
  formatValueDelta,
  type ValueStats,
} from "./value-report.js";

const stats = (overrides: Partial<ValueStats> = {}): ValueStats => ({
  actionsResolved: 0,
  spamBlocked: 0,
  ticketsClosed: 0,
  newMembers: 0,
  membersLost: 0,
  ...overrides,
});

describe("computeValueDelta", () => {
  it("returns flat with null pct when there is no previous value", () => {
    expect(computeValueDelta(10, undefined)).toEqual({
      value: 10,
      deltaPct: null,
      direction: "flat",
    });
  });

  it("computes a positive percentage increase", () => {
    expect(computeValueDelta(120, 100)).toEqual({
      value: 120,
      deltaPct: 20,
      direction: "up",
    });
  });

  it("computes a negative percentage decrease", () => {
    expect(computeValueDelta(80, 100)).toEqual({
      value: 80,
      deltaPct: -20,
      direction: "down",
    });
  });

  it("reports flat with 0 pct for an unchanged non-zero value", () => {
    expect(computeValueDelta(50, 50)).toEqual({
      value: 50,
      deltaPct: 0,
      direction: "flat",
    });
  });

  it("returns null pct but up direction when previous was zero", () => {
    expect(computeValueDelta(7, 0)).toEqual({
      value: 7,
      deltaPct: null,
      direction: "up",
    });
  });

  it("returns null pct and flat when both current and previous are zero", () => {
    expect(computeValueDelta(0, 0)).toEqual({
      value: 0,
      deltaPct: null,
      direction: "flat",
    });
  });

  it("rounds the percentage to an integer", () => {
    expect(computeValueDelta(101, 3).deltaPct).toBe(3267);
    expect(computeValueDelta(10, 3).deltaPct).toBe(233);
  });

  it("is deterministic for identical inputs", () => {
    expect(computeValueDelta(42, 30)).toEqual(computeValueDelta(42, 30));
  });
});

describe("formatValueDelta", () => {
  it("shows only the number without a previous value", () => {
    expect(formatValueDelta(15, undefined)).toBe("15");
  });

  it("formats a positive delta with a plus sign", () => {
    expect(formatValueDelta(120, 100)).toBe("120 (+20%)");
  });

  it("formats a negative delta with a minus sign", () => {
    expect(formatValueDelta(80, 100)).toBe("80 (-20%)");
  });

  it("formats an unchanged value as (=)", () => {
    expect(formatValueDelta(50, 50)).toBe("50 (=)");
  });

  it("marks activity from a zero baseline as (nuevo)", () => {
    expect(formatValueDelta(9, 0)).toBe("9 (nuevo)");
  });

  it("formats zero from a zero baseline as (=)", () => {
    expect(formatValueDelta(0, 0)).toBe("0 (=)");
  });
});

describe("buildValueReport", () => {
  it("uses the Spanish headline with the resolved action count", () => {
    const report = buildValueReport(stats({ actionsResolved: 42 }));
    expect(report.headline).toBe("Modryva resolvio 42 acciones este mes");
    expect(
      report.text.startsWith("Modryva resolvio 42 acciones este mes."),
    ).toBe(true);
  });

  it("produces a delta entry for every metric keyed by its name", () => {
    const report = buildValueReport(
      stats({
        actionsResolved: 10,
        spamBlocked: 20,
        ticketsClosed: 30,
        newMembers: 40,
        membersLost: 5,
      }),
    );
    expect(Object.keys(report.deltas).sort()).toEqual([
      "actionsResolved",
      "membersLost",
      "newMembers",
      "spamBlocked",
      "ticketsClosed",
    ]);
    expect(report.deltas.spamBlocked).toEqual({
      value: 20,
      deltaPct: null,
      direction: "flat",
    });
  });

  it("computes deltas against the previous period", () => {
    const report = buildValueReport(
      stats({ actionsResolved: 120, spamBlocked: 80 }),
      stats({ actionsResolved: 100, spamBlocked: 100 }),
    );
    expect(report.deltas.actionsResolved).toEqual({
      value: 120,
      deltaPct: 20,
      direction: "up",
    });
    expect(report.deltas.spamBlocked).toEqual({
      value: 80,
      deltaPct: -20,
      direction: "down",
    });
  });

  it("includes formatted per-metric lines in the text", () => {
    const report = buildValueReport(
      stats({ actionsResolved: 120 }),
      stats({ actionsResolved: 100 }),
    );
    expect(report.text).toContain("Acciones resueltas: 120 (+20%)");
  });

  it("reports a positive members balance with a plus sign", () => {
    const report = buildValueReport(stats({ newMembers: 10, membersLost: 3 }));
    expect(report.text).toContain("Balance de miembros: +7.");
  });

  it("reports a negative members balance without a plus sign", () => {
    const report = buildValueReport(stats({ newMembers: 2, membersLost: 9 }));
    expect(report.text).toContain("Balance de miembros: -7.");
  });

  it("omits percentages when there is no previous period", () => {
    const report = buildValueReport(stats({ ticketsClosed: 5 }));
    expect(report.text).toContain("Tickets cerrados: 5");
    expect(report.text).not.toContain("%");
  });

  it("is deterministic for identical inputs", () => {
    const current = stats({ actionsResolved: 12, spamBlocked: 3 });
    const prev = stats({ actionsResolved: 10, spamBlocked: 1 });
    expect(buildValueReport(current, prev)).toEqual(
      buildValueReport(current, prev),
    );
  });
});
