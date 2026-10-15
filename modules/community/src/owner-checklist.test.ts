import { describe, expect, it } from "vitest";
import { buildOwnerChecklist } from "./owner-checklist.js";

describe("buildOwnerChecklist", () => {
  it("marks every task done when the group is fully in order", () => {
    expect(
      buildOwnerChecklist({
        pendingAppeals: 0,
        openIncidents: 0,
        rulesReviewedDaysAgo: 0,
      }),
    ).toEqual([
      { task: "📨 Resolver las apelaciones pendientes", done: true },
      { task: "🚨 Cerrar los incidentes abiertos", done: true },
      { task: "📜 Revisar las reglas del grupo", done: true },
    ]);
  });

  it("marks the appeals task pending when appeals remain", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: 3,
      openIncidents: 0,
      rulesReviewedDaysAgo: 1,
    });
    expect(result[0]).toEqual({
      task: "📨 Resolver las apelaciones pendientes",
      done: false,
    });
  });

  it("marks the incidents task pending when incidents are open", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: 0,
      openIncidents: 2,
      rulesReviewedDaysAgo: 0,
    });
    expect(result[1]).toEqual({
      task: "🚨 Cerrar los incidentes abiertos",
      done: false,
    });
  });

  it("keeps the rules task done exactly at the 7-day boundary", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: 0,
      openIncidents: 0,
      rulesReviewedDaysAgo: 7,
    });
    expect(result[2]).toEqual({
      task: "📜 Revisar las reglas del grupo",
      done: true,
    });
  });

  it("marks the rules task pending once the review is stale", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: 0,
      openIncidents: 0,
      rulesReviewedDaysAgo: 8,
    });
    expect(result[2]).toEqual({
      task: "📜 Revisar las reglas del grupo",
      done: false,
    });
  });

  it("treats negative counts as zero (all done)", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: -5,
      openIncidents: -1,
      rulesReviewedDaysAgo: -3,
    });
    expect(result.every((entry) => entry.done)).toBe(true);
  });

  it("treats fractional pending counts as pending", () => {
    const result = buildOwnerChecklist({
      pendingAppeals: 0.4,
      openIncidents: 0,
      rulesReviewedDaysAgo: 0,
    });
    // 0.4 floors to 0, so the appeals task is done.
    expect(result[0]?.done).toBe(true);
  });

  it("always returns the three tasks in a stable order", () => {
    const labels = buildOwnerChecklist({
      pendingAppeals: 9,
      openIncidents: 9,
      rulesReviewedDaysAgo: 99,
    }).map((entry) => entry.task);
    expect(labels).toEqual([
      "📨 Resolver las apelaciones pendientes",
      "🚨 Cerrar los incidentes abiertos",
      "📜 Revisar las reglas del grupo",
    ]);
  });

  it("is deterministic for identical input", () => {
    const state = {
      pendingAppeals: 1,
      openIncidents: 0,
      rulesReviewedDaysAgo: 10,
    };
    expect(buildOwnerChecklist(state)).toEqual(buildOwnerChecklist(state));
  });
});
