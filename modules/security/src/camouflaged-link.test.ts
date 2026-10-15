import { describe, expect, it } from "vitest";
import { detectCamouflagedLink } from "./camouflaged-link.js";

describe("detectCamouflagedLink", () => {
  it("flags a dot split by spaces", () => {
    expect(detectCamouflagedLink("Visita ejemplo . com ahora")).toEqual({
      matched: true,
      reasons: ["espacios"],
    });
  });

  it("flags a unicode dot look-alike", () => {
    expect(detectCamouflagedLink("Entra en banco。com")).toEqual({
      matched: true,
      reasons: ["punto_raro"],
    });
  });

  it("flags a known shortener", () => {
    expect(detectCamouflagedLink("mira bit.ly/abc123")).toEqual({
      matched: true,
      reasons: ["acortador"],
    });
  });

  it("flags an @ hidden inside an http url", () => {
    expect(detectCamouflagedLink("Login http://banco.com@evil.io/x")).toEqual({
      matched: true,
      reasons: ["arroba_url"],
    });
  });

  it("returns reasons in fixed curated order when many trigger", () => {
    const input =
      "Oferta ejemplo . com via bit.ly y punto。raro con http://a.com@b.com";
    expect(detectCamouflagedLink(input)).toEqual({
      matched: true,
      reasons: ["espacios", "punto_raro", "acortador", "arroba_url"],
    });
  });

  it("does not double-count a repeated spaced dot", () => {
    expect(detectCamouflagedLink("a . b y luego c . d")).toEqual({
      matched: true,
      reasons: ["espacios"],
    });
  });

  it("does not flag a shortener substring inside a normal domain", () => {
    expect(detectCamouflagedLink("descarga en part.com hoy")).toEqual({
      matched: false,
      reasons: [],
    });
  });

  it("does not flag a plain legit url", () => {
    expect(detectCamouflagedLink("visita https://ejemplo.com aqui")).toEqual({
      matched: false,
      reasons: [],
    });
  });

  it("returns empty for clean text", () => {
    expect(detectCamouflagedLink("hola amigos como estan")).toEqual({
      matched: false,
      reasons: [],
    });
  });

  it("handles undefined and empty string", () => {
    expect(detectCamouflagedLink(undefined)).toEqual({
      matched: false,
      reasons: [],
    });
    expect(detectCamouflagedLink("")).toEqual({ matched: false, reasons: [] });
  });

  it("is deterministic across repeated calls", () => {
    const input = "bit.ly/x y banco。com";
    const first = detectCamouflagedLink(input);
    const second = detectCamouflagedLink(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      matched: true,
      reasons: ["punto_raro", "acortador"],
    });
  });
});
