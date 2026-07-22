import { describe, expect, it } from "vitest";
import {
  type ApprovedSolutionEntry,
  findApprovedSolution,
} from "./solution-base.js";

const BANK: readonly ApprovedSolutionEntry[] = [
  {
    keywords: ["reembolso", "devolucion"],
    answer: "💶 Nuestra política de reembolsos tarda 5 días hábiles.",
  },
  {
    keywords: ["horario", "abierto"],
    answer: "🕘 Abrimos de 9 a 18h de lunes a viernes.",
  },
  {
    keywords: ["atencion", "soporte"],
    answer: "📞 El equipo de atención responde en menos de 24h.",
  },
];

describe("findApprovedSolution", () => {
  it("returns the first solution sharing a keyword with the query", () => {
    expect(findApprovedSolution("Quiero un reembolso por favor", BANK)).toEqual(
      {
        answer: "💶 Nuestra política de reembolsos tarda 5 días hábiles.",
        matched: true,
      },
    );
  });

  it("matches accent-insensitively when the query has accents", () => {
    expect(findApprovedSolution("¿Cuál es el horário de hoy?", BANK)).toEqual({
      answer: "🕘 Abrimos de 9 a 18h de lunes a viernes.",
      matched: true,
    });
  });

  it("matches accent-insensitively when the keyword lacks accents", () => {
    expect(findApprovedSolution("necesito atención urgente", BANK)).toEqual({
      answer: "📞 El equipo de atención responde en menos de 24h.",
      matched: true,
    });
  });

  it("is case-insensitive", () => {
    expect(findApprovedSolution("SOPORTE", BANK)).toEqual({
      answer: "📞 El equipo de atención responde en menos de 24h.",
      matched: true,
    });
  });

  it("reports no match when no keyword overlaps", () => {
    expect(findApprovedSolution("hola buenos dias", BANK)).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("does not match on partial substrings, only full word tokens", () => {
    expect(findApprovedSolution("reembolsos multiples", BANK)).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("returns no match for an undefined query", () => {
    expect(findApprovedSolution(undefined, BANK)).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("returns no match for an empty query", () => {
    expect(findApprovedSolution("", BANK)).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("returns no match for a punctuation-only query", () => {
    expect(findApprovedSolution("!!! ¿? ...", BANK)).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("returns no match when the solution bank is empty", () => {
    expect(findApprovedSolution("reembolso", [])).toEqual({
      answer: undefined,
      matched: false,
    });
  });

  it("prefers the earliest entry when several solutions match (deterministic order)", () => {
    const overlapping: readonly ApprovedSolutionEntry[] = [
      { keywords: ["envio"], answer: "Primero" },
      { keywords: ["envio"], answer: "Segundo" },
    ];
    expect(findApprovedSolution("estado del envio", overlapping)).toEqual({
      answer: "Primero",
      matched: true,
    });
  });

  it("ignores empty keyword strings without matching everything", () => {
    const withBlank: readonly ApprovedSolutionEntry[] = [
      { keywords: ["", "   "], answer: "No debería salir" },
      { keywords: ["factura"], answer: "Aquí tienes tu factura." },
    ];
    expect(findApprovedSolution("necesito mi factura", withBlank)).toEqual({
      answer: "Aquí tienes tu factura.",
      matched: true,
    });
  });
});
