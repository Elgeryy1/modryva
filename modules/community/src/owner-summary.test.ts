import { describe, expect, it } from "vitest";
import { buildOwnerSummary } from "./owner-summary.js";

describe("buildOwnerSummary", () => {
  it("returns a calm all-clear line when nothing needs attention", () => {
    expect(
      buildOwnerSummary({ pendingAppeals: 0, openIncidents: 0, newMembers: 0 }),
    ).toBe("✅ Todo en orden, nada urgente por ahora.");
  });

  it("lists all three essentials in order with plural forms", () => {
    expect(
      buildOwnerSummary({ pendingAppeals: 3, openIncidents: 2, newMembers: 5 }),
    ).toBe(
      "📋 Lo importante: 3 apelaciones pendientes · 2 incidencias abiertas · 5 miembros nuevos",
    );
  });

  it("uses singular forms when each count is exactly one", () => {
    expect(
      buildOwnerSummary({ pendingAppeals: 1, openIncidents: 1, newMembers: 1 }),
    ).toBe(
      "📋 Lo importante: 1 apelación pendiente · 1 incidencia abierta · 1 miembro nuevo",
    );
  });

  it("omits zero counts and keeps only the relevant essential", () => {
    expect(
      buildOwnerSummary({ pendingAppeals: 0, openIncidents: 2, newMembers: 0 }),
    ).toBe("📋 Lo importante: 2 incidencias abiertas");
  });

  it("preserves appeals-then-members order when incidents are zero", () => {
    expect(
      buildOwnerSummary({ pendingAppeals: 4, openIncidents: 0, newMembers: 1 }),
    ).toBe("📋 Lo importante: 4 apelaciones pendientes · 1 miembro nuevo");
  });

  it("treats negative counts as zero", () => {
    expect(
      buildOwnerSummary({
        pendingAppeals: -5,
        openIncidents: -1,
        newMembers: -3,
      }),
    ).toBe("✅ Todo en orden, nada urgente por ahora.");
  });

  it("floors fractional counts to whole numbers", () => {
    expect(
      buildOwnerSummary({
        pendingAppeals: 2.9,
        openIncidents: 0,
        newMembers: 1.4,
      }),
    ).toBe("📋 Lo importante: 2 apelaciones pendientes · 1 miembro nuevo");
  });

  it("treats non-finite counts as zero", () => {
    expect(
      buildOwnerSummary({
        pendingAppeals: Number.NaN,
        openIncidents: Number.POSITIVE_INFINITY,
        newMembers: 0,
      }),
    ).toBe("✅ Todo en orden, nada urgente por ahora.");
  });

  it("is deterministic for repeated calls with the same input", () => {
    const state = {
      pendingAppeals: 2,
      openIncidents: 3,
      newMembers: 0,
    } as const;
    const first = buildOwnerSummary(state);
    const second = buildOwnerSummary(state);
    expect(first).toBe(second);
    expect(first).toBe(
      "📋 Lo importante: 2 apelaciones pendientes · 3 incidencias abiertas",
    );
  });
});
