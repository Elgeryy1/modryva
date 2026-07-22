import { describe, expect, it } from "vitest";
import { routeDiscreetHelp } from "./discreet-help.js";

describe("routeDiscreetHelp", () => {
  it("routes a plain help request to privado", () => {
    expect(routeDiscreetHelp({ text: "Necesito ayuda por favor" })).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["ayuda"],
    });
  });

  it("detects socorro regardless of case and punctuation", () => {
    expect(routeDiscreetHelp({ text: "SOCORRO!!" })).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["socorro"],
    });
  });

  it("is accent-insensitive for multi-word phrases", () => {
    expect(routeDiscreetHelp({ text: "Necesíto a un admin urgente" })).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["necesito a un admin"],
    });
  });

  it("returns matched phrases in HELP_PHRASES order", () => {
    expect(
      routeDiscreetHelp({ text: "quiero reportar en privado, necesito ayuda" }),
    ).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["ayuda", "reportar en privado"],
    });
  });

  it("does not flag clean conversational text", () => {
    expect(routeDiscreetHelp({ text: "Hola, buenos dias a todos" })).toEqual({
      needsHelp: false,
      channel: "ninguno",
      matched: [],
    });
  });

  it("treats empty text as no help", () => {
    expect(routeDiscreetHelp({ text: "" })).toEqual({
      needsHelp: false,
      channel: "ninguno",
      matched: [],
    });
  });

  it("treats whitespace-only text as no help", () => {
    expect(routeDiscreetHelp({ text: "   \n  " })).toEqual({
      needsHelp: false,
      channel: "ninguno",
      matched: [],
    });
  });

  it("matches a phrase embedded inside a larger word boundary of text", () => {
    expect(routeDiscreetHelp({ text: "porfa AYUDAME" })).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["ayuda"],
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { text: "Socorro, necesito a un admin" };
    const first = routeDiscreetHelp(input);
    const second = routeDiscreetHelp(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      needsHelp: true,
      channel: "privado",
      matched: ["socorro", "necesito a un admin"],
    });
  });
});
