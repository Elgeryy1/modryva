import { describe, expect, it } from "vitest";
import { type ChatLine, summarizeFight } from "./fight-summary.js";

const line = (userId: string, text: string, ms: number): ChatLine => ({
  userId,
  text,
  ms,
});

describe("summarizeFight", () => {
  it("identifies the starter as the first hostile author", () => {
    const lines = [
      line("a", "hola que tal", 1),
      line("b", "eres un idiota", 2),
      line("a", "callate tu", 3),
    ];
    const result = summarizeFight(lines);
    expect(result.starterId).toBe("b");
    expect(result.insultCount).toBe(2);
  });

  it("lists unique participants in order of appearance", () => {
    const lines = [
      line("a", "x", 1),
      line("b", "y", 2),
      line("a", "z", 3),
      line("c", "w", 4),
    ];
    expect(summarizeFight(lines).participants).toEqual(["a", "b", "c"]);
  });

  it("reports zero insults and no starter for a calm chat", () => {
    const result = summarizeFight([
      line("a", "buenas", 1),
      line("b", "hola", 2),
    ]);
    expect(result.insultCount).toBe(0);
    expect(result.starterId).toBeUndefined();
    expect("starterId" in result).toBe(false);
  });

  it("is accent- and case-insensitive for markers", () => {
    expect(summarizeFight([line("a", "ESTÚPIDO", 1)]).insultCount).toBe(1);
  });

  it("counts every hostile line", () => {
    const lines = [
      line("a", "idiota", 1),
      line("b", "mierda", 2),
      line("c", "hola", 3),
      line("a", "payaso", 4),
    ];
    expect(summarizeFight(lines).insultCount).toBe(3);
  });

  it("returns empty participants for no lines", () => {
    const result = summarizeFight([]);
    expect(result.participants).toEqual([]);
    expect(result.insultCount).toBe(0);
    expect(result.text).toContain("0 participante");
  });

  it("includes the starter in the text when there is a fight", () => {
    const result = summarizeFight([line("bob", "eres un imbecil", 1)]);
    expect(result.text).toContain("bob");
  });

  it("is deterministic", () => {
    const lines = [line("a", "idiota", 1), line("b", "callate", 2)];
    expect(summarizeFight(lines)).toEqual(summarizeFight(lines));
  });
});
