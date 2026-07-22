import { describe, expect, it } from "vitest";
import {
  buildMonthlyReport,
  formatMonthlyDelta,
  type MonthStats,
  monthlyNetGrowth,
} from "./monthly-report.js";

const stats = (overrides: Partial<MonthStats> = {}): MonthStats => ({
  actions: 42,
  spam: 10,
  newMembers: 30,
  lostMembers: 5,
  ...overrides,
});

describe("monthlyNetGrowth", () => {
  it("subtracts bajas from nuevos", () => {
    expect(monthlyNetGrowth(stats())).toBe(25);
  });

  it("is negative when the group shrank", () => {
    expect(monthlyNetGrowth(stats({ newMembers: 3, lostMembers: 8 }))).toBe(-5);
  });

  it("is zero when nuevos equals bajas", () => {
    expect(monthlyNetGrowth(stats({ newMembers: 7, lostMembers: 7 }))).toBe(0);
  });
});

describe("formatMonthlyDelta", () => {
  it("prefixes positive numbers with +", () => {
    expect(formatMonthlyDelta(5)).toBe("+5");
  });

  it("keeps the minus sign for negatives", () => {
    expect(formatMonthlyDelta(-3)).toBe("-3");
  });

  it("renders zero as ±0", () => {
    expect(formatMonthlyDelta(0)).toBe("±0");
  });
});

describe("buildMonthlyReport", () => {
  it("renders the current month without a comparison block", () => {
    const report = buildMonthlyReport(stats());
    expect(report.text).toBe(
      [
        "📊 Informe mensual",
        "",
        "🛡️ Acciones de moderación: 42",
        "🚫 Spam bloqueado: 10",
        "🎉 Nuevos miembros: 30",
        "👋 Bajas: 5",
        "📈 Crecimiento neto: +25",
      ].join("\n"),
    );
  });

  it("returns empty deltas when previous is omitted", () => {
    expect(buildMonthlyReport(stats()).deltas).toEqual({});
  });

  it("does not include the comparison heading without previous", () => {
    expect(buildMonthlyReport(stats()).text).not.toContain(
      "Comparación con el mes anterior:",
    );
  });

  it("shows a negative net growth line", () => {
    const report = buildMonthlyReport(stats({ newMembers: 2, lostMembers: 9 }));
    expect(report.text).toContain("📈 Crecimiento neto: -7");
  });

  it("shows a ±0 net growth line when flat", () => {
    const report = buildMonthlyReport(stats({ newMembers: 4, lostMembers: 4 }));
    expect(report.text).toContain("📈 Crecimiento neto: ±0");
  });

  it("computes deltas as current minus previous", () => {
    const current = stats({
      actions: 42,
      spam: 10,
      newMembers: 30,
      lostMembers: 5,
    });
    const previous = stats({
      actions: 37,
      spam: 12,
      newMembers: 20,
      lostMembers: 6,
    });
    expect(buildMonthlyReport(current, previous).deltas).toEqual({
      actions: 5,
      spam: -2,
      newMembers: 10,
      lostMembers: -1,
    });
  });

  it("renders the comparison block with signed deltas", () => {
    const current = stats({
      actions: 42,
      spam: 10,
      newMembers: 30,
      lostMembers: 5,
    });
    const previous = stats({
      actions: 37,
      spam: 12,
      newMembers: 20,
      lostMembers: 6,
    });
    expect(buildMonthlyReport(current, previous).text).toBe(
      [
        "📊 Informe mensual",
        "",
        "🛡️ Acciones de moderación: 42",
        "🚫 Spam bloqueado: 10",
        "🎉 Nuevos miembros: 30",
        "👋 Bajas: 5",
        "📈 Crecimiento neto: +25",
        "",
        "Comparación con el mes anterior:",
        "🛡️ Acciones: +5",
        "🚫 Spam: -2",
        "🎉 Nuevos: +10",
        "👋 Bajas: -1",
      ].join("\n"),
    );
  });

  it("renders ±0 for unchanged metrics in the comparison block", () => {
    const same = stats();
    const report = buildMonthlyReport(same, same);
    expect(report.text).toContain("🛡️ Acciones: ±0");
    expect(report.text).toContain("🚫 Spam: ±0");
    expect(report.text).toContain("🎉 Nuevos: ±0");
    expect(report.text).toContain("👋 Bajas: ±0");
    expect(report.deltas).toEqual({
      actions: 0,
      spam: 0,
      newMembers: 0,
      lostMembers: 0,
    });
  });

  it("handles a first month of all zeros", () => {
    const zero = stats({
      actions: 0,
      spam: 0,
      newMembers: 0,
      lostMembers: 0,
    });
    const report = buildMonthlyReport(zero);
    expect(report.text).toContain("🛡️ Acciones de moderación: 0");
    expect(report.text).toContain("📈 Crecimiento neto: ±0");
    expect(report.deltas).toEqual({});
  });

  it("is deterministic for identical inputs", () => {
    const current = stats({
      actions: 11,
      spam: 3,
      newMembers: 9,
      lostMembers: 2,
    });
    const previous = stats({
      actions: 8,
      spam: 5,
      newMembers: 4,
      lostMembers: 1,
    });
    expect(buildMonthlyReport(current, previous)).toEqual(
      buildMonthlyReport(current, previous),
    );
  });
});
