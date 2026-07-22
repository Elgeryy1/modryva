import { describe, expect, it } from "vitest";
import {
  countSharedKeywords,
  groupSimilarIncidents,
  incidentKeywords,
  isLikelyDuplicate,
  normalizeIncidentText,
} from "./incident-dedup.js";

describe("normalizeIncidentText", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(normalizeIncidentText("  El   PAGO   fallo  ")).toBe(
      "el pago fallo",
    );
  });

  it("removes accents and diacritics", () => {
    expect(normalizeIncidentText("Notificacion caida en sesion")).toBe(
      normalizeIncidentText("Notificación caída en sesión"),
    );
  });

  it("drops punctuation and symbols but keeps alphanumerics", () => {
    expect(normalizeIncidentText("Error 500: no carga!!! (grave)")).toBe(
      "error 500 no carga grave",
    );
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeIncidentText("!!! ??? ...")).toBe("");
  });
});

describe("incidentKeywords", () => {
  it("extracts unique keywords in first-appearance order", () => {
    expect(incidentKeywords("la app cierra la app sola")).toEqual([
      "app",
      "cierra",
      "sola",
    ]);
  });

  it("drops stopwords and short tokens", () => {
    expect(incidentKeywords("no se ve el boton de pago")).toEqual([
      "boton",
      "pago",
    ]);
  });

  it("keeps numeric tokens of sufficient length", () => {
    expect(incidentKeywords("error 500 en checkout")).toEqual([
      "error",
      "500",
      "checkout",
    ]);
  });

  it("returns empty for blank or stopword-only text", () => {
    expect(incidentKeywords("   ")).toEqual([]);
    expect(incidentKeywords("y el de la")).toEqual([]);
  });
});

describe("countSharedKeywords", () => {
  it("counts the intersection of keyword sets", () => {
    expect(
      countSharedKeywords(
        "el pago falla en checkout",
        "checkout con pago roto",
      ),
    ).toBe(2);
  });

  it("returns 0 when there is no overlap", () => {
    expect(countSharedKeywords("pago rechazado", "video no carga")).toBe(0);
  });

  it("returns 0 when either side has no keywords", () => {
    expect(countSharedKeywords("", "pago falla")).toBe(0);
    expect(countSharedKeywords("pago falla", "de la y el")).toBe(0);
  });
});

describe("isLikelyDuplicate", () => {
  it("is true when shared keywords meet the threshold", () => {
    expect(
      isLikelyDuplicate("el pago falla siempre", "pago falla en la caja", 2),
    ).toBe(true);
  });

  it("is false when shared keywords fall below the threshold", () => {
    expect(
      isLikelyDuplicate("el pago falla siempre", "pago rapido y comodo", 2),
    ).toBe(false);
  });

  it("counts accented and unaccented variants as the same word", () => {
    expect(isLikelyDuplicate("sesión caída", "sesion caida otra vez", 2)).toBe(
      true,
    );
  });

  it("is false for a non-positive threshold", () => {
    expect(isLikelyDuplicate("pago falla", "pago falla", 0)).toBe(false);
    expect(isLikelyDuplicate("pago falla", "pago falla", -3)).toBe(false);
  });
});

describe("groupSimilarIncidents", () => {
  it("returns an empty array for no texts", () => {
    expect(groupSimilarIncidents([], 2)).toEqual([]);
  });

  it("puts every distinct incident in its own group", () => {
    const texts = ["pago rechazado", "video congelado", "login imposible"];
    expect(groupSimilarIncidents(texts, 2)).toEqual([[0], [1], [2]]);
  });

  it("groups incidents that share enough keywords", () => {
    const texts = [
      "el pago falla en checkout",
      "checkout con el pago roto",
      "el video no carga nunca",
    ];
    expect(groupSimilarIncidents(texts, 2)).toEqual([[0, 1], [2]]);
  });

  it("groups transitively when links chain together", () => {
    const texts = [
      "pago falla checkout",
      "pago falla siempre",
      "falla checkout tarjeta",
    ];
    // 0~1 (pago, falla) y 0~2 (falla, checkout) => todos juntos.
    expect(groupSimilarIncidents(texts, 2)).toEqual([[0, 1, 2]]);
  });

  it("preserves original order of groups and indices", () => {
    const texts = [
      "video no carga",
      "pago falla checkout",
      "video no carga otra vez",
      "pago falla checkout ahora",
    ];
    expect(groupSimilarIncidents(texts, 2)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it("treats keyword-less texts as their own singleton groups", () => {
    const texts = ["pago falla checkout", "de la y el", "pago falla checkout"];
    expect(groupSimilarIncidents(texts, 2)).toEqual([[0, 2], [1]]);
  });

  it("keeps every incident separate for a non-positive threshold", () => {
    const texts = ["pago falla", "pago falla", "pago falla"];
    expect(groupSimilarIncidents(texts, 0)).toEqual([[0], [1], [2]]);
  });

  it("covers all indices exactly once", () => {
    const texts = [
      "pago falla checkout",
      "video congelado",
      "pago falla checkout de nuevo",
      "login imposible hoy",
      "video congelado siempre",
    ];
    const groups = groupSimilarIncidents(texts, 2);
    const flat = groups.flatMap((group) => [...group]).sort((a, b) => a - b);
    expect(flat).toEqual([0, 1, 2, 3, 4]);
  });

  it("is deterministic across repeated calls", () => {
    const texts = [
      "el pago falla en checkout",
      "checkout con el pago roto",
      "el video no carga",
      "video congelado en la app",
    ];
    expect(groupSimilarIncidents(texts, 2)).toEqual(
      groupSimilarIncidents(texts, 2),
    );
  });

  it("raising the threshold splits a previously merged group", () => {
    const texts = ["pago falla checkout", "pago lento checkout"];
    expect(groupSimilarIncidents(texts, 2)).toEqual([[0, 1]]);
    expect(groupSimilarIncidents(texts, 3)).toEqual([[0], [1]]);
  });
});
