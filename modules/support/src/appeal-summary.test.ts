import { describe, expect, it } from "vitest";
import { summarizeAppealForStaff } from "./appeal-summary.js";

describe("summarizeAppealForStaff", () => {
  it("summarizes a medium appeal with evidence as high priority", () => {
    expect(
      summarizeAppealForStaff({
        category: "spam",
        length: 200,
        hasEvidence: true,
      }),
    ).toBe(
      "📋 Apelación [spam] — descripción de longitud media, con pruebas. Prioridad: alta.",
    );
  });

  it("marks a long appeal with evidence as high priority and extensa", () => {
    expect(
      summarizeAppealForStaff({
        category: "ban",
        length: 900,
        hasEvidence: true,
      }),
    ).toBe(
      "📋 Apelación [ban] — descripción extensa, con pruebas. Prioridad: alta.",
    );
  });

  it("marks a long appeal without evidence as medium priority", () => {
    expect(
      summarizeAppealForStaff({
        category: "mute",
        length: 600,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [mute] — descripción extensa, sin pruebas. Prioridad: media.",
    );
  });

  it("marks a short appeal with evidence as medium priority", () => {
    expect(
      summarizeAppealForStaff({
        category: "warn",
        length: 50,
        hasEvidence: true,
      }),
    ).toBe(
      "📋 Apelación [warn] — descripción breve, con pruebas. Prioridad: media.",
    );
  });

  it("marks a short appeal without evidence as low priority", () => {
    expect(
      summarizeAppealForStaff({
        category: "warn",
        length: 50,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [warn] — descripción breve, sin pruebas. Prioridad: baja.",
    );
  });

  it("falls back to a neutral category label when blank", () => {
    expect(
      summarizeAppealForStaff({
        category: "   ",
        length: 10,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [sin categoría] — descripción breve, sin pruebas. Prioridad: baja.",
    );
  });

  it("reports empty content for zero length", () => {
    expect(
      summarizeAppealForStaff({
        category: "spam",
        length: 0,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [spam] — descripción sin contenido, sin pruebas. Prioridad: baja.",
    );
  });

  it("treats negative length as empty content", () => {
    expect(
      summarizeAppealForStaff({
        category: "spam",
        length: -5,
        hasEvidence: true,
      }),
    ).toBe(
      "📋 Apelación [spam] — descripción sin contenido, con pruebas. Prioridad: media.",
    );
  });

  it("keeps 140 chars as breve and low priority on the boundary", () => {
    expect(
      summarizeAppealForStaff({
        category: "flood",
        length: 140,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [flood] — descripción breve, sin pruebas. Prioridad: baja.",
    );
  });

  it("promotes 141 chars past the short boundary to media length", () => {
    expect(
      summarizeAppealForStaff({
        category: "flood",
        length: 141,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [flood] — descripción de longitud media, sin pruebas. Prioridad: media.",
    );
  });

  it("treats 500 chars as the upper edge of media length", () => {
    expect(
      summarizeAppealForStaff({
        category: "flood",
        length: 500,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [flood] — descripción de longitud media, sin pruebas. Prioridad: media.",
    );
  });

  it("trims surrounding whitespace from the category", () => {
    expect(
      summarizeAppealForStaff({
        category: "  abuse  ",
        length: 10,
        hasEvidence: false,
      }),
    ).toBe(
      "📋 Apelación [abuse] — descripción breve, sin pruebas. Prioridad: baja.",
    );
  });

  it("is deterministic across repeated calls", () => {
    const input = { category: "spam", length: 200, hasEvidence: true } as const;
    expect(summarizeAppealForStaff(input)).toBe(summarizeAppealForStaff(input));
  });
});
