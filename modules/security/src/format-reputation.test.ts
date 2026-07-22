import { describe, expect, it } from "vitest";
import {
  FORMAT_REPUTATION_CTA_PHRASES,
  type FormatReputationResult,
  findFormatReputationCtas,
  scoreFormatReputation,
} from "./format-reputation.js";

const clean = (text: string): boolean => {
  const result: FormatReputationResult = scoreFormatReputation(text);
  return result.score === 100 && result.issues.length === 0;
};

describe("scoreFormatReputation — clean text", () => {
  it("scores empty text as perfectly clean", () => {
    expect(clean("")).toBe(true);
  });

  it("scores an ordinary sentence as clean", () => {
    expect(clean("Hola, buenos dias a todos, que tengan un buen dia.")).toBe(
      true,
    );
  });

  it("does not penalize a short all-caps acronym", () => {
    // Below the min-cased threshold, so no shouting penalty.
    expect(clean("Vale OK")).toBe(true);
  });

  it("clamps the score within 0..100 for a heavily spammy message", () => {
    const result = scoreFormatReputation(
      "COMPRA YA!!!! GANA DINERO FACIL 🤑🤑🤑🤑🤑🤑 CLICK AQUI $$$$$",
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("scoreFormatReputation — uppercase", () => {
  it("penalizes shouting when most cased letters are uppercase", () => {
    const result = scoreFormatReputation("ESTO ES UNA ESTAFA ENORME AHORA");
    expect(result.issues).toContain("Exceso de mayúsculas");
    expect(result.score).toBeLessThan(100);
  });

  it("ignores uppercase in very short messages", () => {
    const result = scoreFormatReputation("HOLA");
    expect(result.issues).not.toContain("Exceso de mayúsculas");
  });

  it("does not penalize mixed-case with a minority of capitals", () => {
    const result = scoreFormatReputation(
      "Esto Es Un Texto Normal Con Algunas Iniciales",
    );
    expect(result.issues).not.toContain("Exceso de mayúsculas");
  });
});

describe("scoreFormatReputation — emojis", () => {
  it("penalizes too many distinct emojis", () => {
    const result = scoreFormatReputation("hola 😀 😁 😂 🤣 😃 😄 mundo");
    expect(result.issues).toContain("Demasiados emojis");
    expect(result.score).toBeLessThan(100);
  });

  it("penalizes a long identical-emoji run", () => {
    const result = scoreFormatReputation("mira esto 🔥🔥🔥🔥");
    expect(result.issues).toContain("Emojis repetidos");
  });

  it("does not flag a single emoji", () => {
    expect(clean("buen trabajo 👍")).toBe(true);
  });
});

describe("scoreFormatReputation — symbols", () => {
  it("penalizes a message drenched in symbols", () => {
    const result = scoreFormatReputation("@@@###$$$%%%&&&");
    expect(result.issues).toContain("Exceso de símbolos");
    expect(result.score).toBeLessThan(100);
  });

  it("penalizes repeated punctuation runs", () => {
    const result = scoreFormatReputation("no me lo puedo creer!!!");
    expect(result.issues).toContain("Puntuación repetida");
  });

  it("allows a normal single exclamation", () => {
    expect(clean("que bien lo pase ayer!")).toBe(true);
  });
});

describe("findFormatReputationCtas", () => {
  it("matches a CTA ignoring case and accents", () => {
    expect(findFormatReputationCtas("Pincha AQUÍ para ganar")).toEqual([
      "pincha aqui",
    ]);
  });

  it("returns matches in declaration order without duplicates", () => {
    const matches = findFormatReputationCtas(
      "compra ya, compra ya y luego click aqui",
    );
    expect(matches).toEqual(["compra ya", "click aqui"]);
  });

  it("returns empty for text without CTAs", () => {
    expect(findFormatReputationCtas("una charla tranquila")).toEqual([]);
  });

  it("only exposes lowercased accent-free phrases", () => {
    for (const phrase of FORMAT_REPUTATION_CTA_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
      expect(phrase.normalize("NFD").replace(/\p{Diacritic}/gu, "")).toBe(
        phrase,
      );
    }
  });
});

describe("scoreFormatReputation — CTA penalty", () => {
  it("flags spammy calls to action", () => {
    const result = scoreFormatReputation("Gana dinero facil desde casa");
    expect(result.issues).toContain("Llamadas a la acción de spam");
    expect(result.score).toBeLessThan(100);
  });

  it("does not flag ordinary text as CTA", () => {
    const result = scoreFormatReputation("manana compro el pan tranquilamente");
    expect(result.issues).not.toContain("Llamadas a la acción de spam");
  });
});

describe("scoreFormatReputation — determinism & bounds", () => {
  it("returns the same result for identical input", () => {
    const text = "COMPRA YA 🔥🔥🔥 click aqui!!!";
    expect(scoreFormatReputation(text)).toEqual(scoreFormatReputation(text));
  });

  it("never returns a score outside 0..100 across varied inputs", () => {
    const samples = [
      "",
      "texto normal",
      "GRITANDO MUCHISIMO POR AQUI AHORA",
      "🤑🤑🤑🤑🤑🤑🤑🤑",
      "$$$$$$$$$$$$",
      "compra ya gana dinero facil click aqui oferta limitada",
    ];
    for (const sample of samples) {
      const { score } = scoreFormatReputation(sample);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it("accumulates multiple issues for a multi-problem message", () => {
    const result = scoreFormatReputation(
      "COMPRA YA!!! 🔥🔥🔥🔥 $$$$$ GANA DINERO FACIL",
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});
