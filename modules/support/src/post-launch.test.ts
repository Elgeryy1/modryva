import { describe, expect, it } from "vitest";
import { buildPostLaunchReport } from "./post-launch.js";

describe("buildPostLaunchReport", () => {
  it("computes an excellent engagement rate and summary", () => {
    expect(
      buildPostLaunchReport({ reach: 10, reactions: 3, questions: 2 }),
    ).toEqual({
      engagementRate: 0.5,
      summary:
        "📊 Informe post-lanzamiento: alcance de 10, 3 reacciones y 2 preguntas. Participación 50% (excelente).",
    });
  });

  it("labels a mid-range rate as buena and rounds to two decimals", () => {
    expect(
      buildPostLaunchReport({ reach: 3, reactions: 1, questions: 0 }),
    ).toEqual({
      engagementRate: 0.33,
      summary:
        "📊 Informe post-lanzamiento: alcance de 3, 1 reacciones y 0 preguntas. Participación 33% (buena).",
    });
  });

  it("labels a tiny positive rate as mejorable", () => {
    expect(
      buildPostLaunchReport({ reach: 100, reactions: 1, questions: 0 }),
    ).toEqual({
      engagementRate: 0.01,
      summary:
        "📊 Informe post-lanzamiento: alcance de 100, 1 reacciones y 0 preguntas. Participación 1% (mejorable).",
    });
  });

  it("labels zero interactions with positive reach as sin interaccion", () => {
    expect(
      buildPostLaunchReport({ reach: 10, reactions: 0, questions: 0 }),
    ).toEqual({
      engagementRate: 0,
      summary:
        "📊 Informe post-lanzamiento: alcance de 10, 0 reacciones y 0 preguntas. Participación 0% (sin interacción).",
    });
  });

  it("guards against zero reach", () => {
    expect(
      buildPostLaunchReport({ reach: 0, reactions: 5, questions: 5 }),
    ).toEqual({
      engagementRate: 0,
      summary: "📊 Informe post-lanzamiento: sin alcance registrado todavía.",
    });
  });

  it("guards against negative reach", () => {
    expect(
      buildPostLaunchReport({ reach: -4, reactions: 2, questions: 1 }),
    ).toEqual({
      engagementRate: 0,
      summary: "📊 Informe post-lanzamiento: sin alcance registrado todavía.",
    });
  });

  it("caps at rate 1 when interactions equal reach", () => {
    const report = buildPostLaunchReport({
      reach: 8,
      reactions: 5,
      questions: 3,
    });
    expect(report.engagementRate).toBe(1);
    expect(report.summary).toContain("Participación 100% (excelente).");
  });

  it("handles a rate above 1 when interactions exceed reach", () => {
    const report = buildPostLaunchReport({
      reach: 4,
      reactions: 5,
      questions: 3,
    });
    expect(report.engagementRate).toBe(2);
    expect(report.summary).toContain("Participación 200% (excelente).");
  });

  it("is deterministic across repeated calls", () => {
    const input = { reach: 25, reactions: 4, questions: 1 } as const;
    const first = buildPostLaunchReport(input);
    const second = buildPostLaunchReport(input);
    expect(first).toEqual(second);
    expect(first.engagementRate).toBe(0.2);
  });
});
