import { describe, expect, it } from "vitest";
import { extractFaq, type QaPair } from "./faq-extractor.js";

const qa = (overrides: Partial<QaPair> = {}): QaPair => ({
  question: "Como reinicio el bot?",
  answer: "Usa el comando /restart.",
  upvotes: 0,
  approved: true,
  ...overrides,
});

describe("extractFaq", () => {
  it("returns an empty array for no pairs", () => {
    expect(extractFaq([], 0)).toEqual([]);
  });

  it("excludes pairs that are not approved", () => {
    const pairs = [
      qa({ question: "P1", approved: false, upvotes: 10 }),
      qa({ question: "P2", approved: true, upvotes: 5 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "P2", answer: "Usa el comando /restart." },
    ]);
  });

  it("excludes pairs below minUpvotes", () => {
    const pairs = [
      qa({ question: "P1", upvotes: 2 }),
      qa({ question: "P2", upvotes: 5 }),
    ];
    expect(extractFaq(pairs, 3)).toEqual([
      { question: "P2", answer: "Usa el comando /restart." },
    ]);
  });

  it("includes pairs exactly at minUpvotes (inclusive bound)", () => {
    const pairs = [qa({ question: "P1", upvotes: 3 })];
    expect(extractFaq(pairs, 3)).toEqual([
      { question: "P1", answer: "Usa el comando /restart." },
    ]);
  });

  it("orders by upvotes descending", () => {
    const pairs = [
      qa({ question: "baja", answer: "a", upvotes: 1 }),
      qa({ question: "alta", answer: "b", upvotes: 9 }),
      qa({ question: "media", answer: "c", upvotes: 5 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "alta", answer: "b" },
      { question: "media", answer: "c" },
      { question: "baja", answer: "a" },
    ]);
  });

  it("keeps input order for equal upvotes (stable sort)", () => {
    const pairs = [
      qa({ question: "primera", answer: "1", upvotes: 4 }),
      qa({ question: "segunda", answer: "2", upvotes: 4 }),
      qa({ question: "tercera", answer: "3", upvotes: 4 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "primera", answer: "1" },
      { question: "segunda", answer: "2" },
      { question: "tercera", answer: "3" },
    ]);
  });

  it("deduplicates by normalized question keeping the first after sorting", () => {
    const pairs = [
      qa({ question: "Como pago?", answer: "vieja", upvotes: 2 }),
      qa({ question: "Como pago?", answer: "nueva", upvotes: 8 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "Como pago?", answer: "nueva" },
    ]);
  });

  it("treats questions differing only in case/whitespace as duplicates", () => {
    const pairs = [
      qa({ question: "  Como   Pago?  ", answer: "primera", upvotes: 5 }),
      qa({ question: "como pago?", answer: "segunda", upvotes: 3 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "  Como   Pago?  ", answer: "primera" },
    ]);
  });

  it("preserves the original question text of the surviving entry", () => {
    const pairs = [qa({ question: "  Hola Mundo  ", answer: "x", upvotes: 1 })];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "  Hola Mundo  ", answer: "x" },
    ]);
  });

  it("keeps distinct questions separate", () => {
    const pairs = [
      qa({ question: "P1", answer: "a", upvotes: 3 }),
      qa({ question: "P2", answer: "b", upvotes: 3 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual([
      { question: "P1", answer: "a" },
      { question: "P2", answer: "b" },
    ]);
  });

  it("filters out unapproved even when heavily upvoted", () => {
    const pairs = [qa({ question: "P1", approved: false, upvotes: 999 })];
    expect(extractFaq(pairs, 0)).toEqual([]);
  });

  it("handles a negative minUpvotes as a permissive threshold", () => {
    const pairs = [qa({ question: "P1", upvotes: 0 })];
    expect(extractFaq(pairs, -5)).toEqual([
      { question: "P1", answer: "Usa el comando /restart." },
    ]);
  });

  it("combines filtering, sorting and dedup together", () => {
    const pairs = [
      qa({ question: "dup", answer: "dup-baja", upvotes: 4 }),
      qa({ question: "no-aprobada", approved: false, upvotes: 100 }),
      qa({ question: "top", answer: "top-ans", upvotes: 10 }),
      qa({ question: "DUP", answer: "dup-alta", upvotes: 7 }),
      qa({ question: "baja", answer: "baja-ans", upvotes: 1 }),
    ];
    expect(extractFaq(pairs, 3)).toEqual([
      { question: "top", answer: "top-ans" },
      { question: "DUP", answer: "dup-alta" },
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const pairs = [
      qa({ question: "a", upvotes: 5 }),
      qa({ question: "b", upvotes: 5 }),
      qa({ question: "c", upvotes: 8 }),
    ];
    expect(extractFaq(pairs, 0)).toEqual(extractFaq(pairs, 0));
  });

  it("does not mutate the input array", () => {
    const pairs = [
      qa({ question: "a", upvotes: 1 }),
      qa({ question: "b", upvotes: 9 }),
    ];
    const snapshot = [...pairs];
    extractFaq(pairs, 0);
    expect(pairs).toEqual(snapshot);
  });

  it("returns entries with only question and answer keys", () => {
    const pairs = [qa({ question: "P1", answer: "R1", upvotes: 5 })];
    const result = extractFaq(pairs, 0);
    expect(result[0] ?? null).toEqual({ question: "P1", answer: "R1" });
  });
});
