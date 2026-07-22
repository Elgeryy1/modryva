import { describe, expect, it } from "vitest";
import { detectSpoiler, SPOILER_MARKERS } from "./spoiler-filter.js";

describe("detectSpoiler", () => {
  it("flags a built-in generic marker", () => {
    expect(
      detectSpoiler("Cuidado, el protagonista MUERE al final", []),
    ).toEqual({
      matched: true,
      hits: ["muere"],
    });
  });

  it("flags configured keywords in input order", () => {
    expect(
      detectSpoiler("Nuevo trailer de Dune parte tres", ["Dune", "trailer"]),
    ).toEqual({
      matched: true,
      hits: ["dune", "trailer"],
    });
  });

  it("orders markers first then keywords, deduplicated", () => {
    expect(
      detectSpoiler("El spoiler de Loki: aqui muere el villano", ["loki"]),
    ).toEqual({
      matched: true,
      hits: ["spoiler", "muere", "loki"],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectSpoiler("Que ganas de ver el estreno", [])).toEqual({
      matched: false,
      hits: [],
    });
  });

  it("handles undefined text", () => {
    expect(detectSpoiler(undefined, ["dune"])).toEqual({
      matched: false,
      hits: [],
    });
  });

  it("handles empty text", () => {
    expect(detectSpoiler("", ["dune"])).toEqual({ matched: false, hits: [] });
  });

  it("deduplicates a keyword that equals a built-in marker", () => {
    expect(
      detectSpoiler("hay un spoiler enorme", ["Spoiler", "SPOILER"]),
    ).toEqual({
      matched: true,
      hits: ["spoiler"],
    });
  });

  it("ignores empty and whitespace-only keywords instead of matching everything", () => {
    expect(detectSpoiler("una serie cualquiera", ["", "   "])).toEqual({
      matched: false,
      hits: [],
    });
  });

  it("matches multi-word markers case-insensitively", () => {
    expect(detectSpoiler("EL FINAL DE la temporada fue brutal", [])).toEqual({
      matched: true,
      hits: ["final de"],
    });
  });

  it("preserves keyword order and is deterministic across calls", () => {
    const text = "zeta alfa beta";
    const keywords = ["beta", "alfa", "zeta"];
    const first = detectSpoiler(text, keywords);
    const second = detectSpoiler(text, keywords);
    expect(first).toEqual({ matched: true, hits: ["beta", "alfa", "zeta"] });
    expect(second).toEqual(first);
  });

  it("exposes the built-in markers as lowercase ascii", () => {
    expect(SPOILER_MARKERS).toContain("spoiler");
    for (const marker of SPOILER_MARKERS) {
      expect(marker).toBe(marker.toLowerCase());
    }
  });
});
