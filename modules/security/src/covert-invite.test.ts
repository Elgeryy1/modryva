import { describe, expect, it } from "vitest";
import { COVERT_INVITE_PHRASES, detectCovertInvite } from "./covert-invite.js";

describe("detectCovertInvite", () => {
  it("flags a single covert-invite phrase", () => {
    expect(detectCovertInvite("Mira mi bio para el link")).toEqual({
      matched: true,
      phrases: ["mira mi bio"],
    });
  });

  it("flags the 'canal de mi perfil' hook", () => {
    expect(detectCovertInvite("Entra al canal de mi perfil")).toEqual({
      matched: true,
      phrases: ["canal de mi perfil"],
    });
  });

  it("normalizes accents, case and ignores emojis", () => {
    expect(detectCovertInvite("Escríbeme por privado 😉")).toEqual({
      matched: true,
      phrases: ["escribeme"],
    });
  });

  it("returns multiple matches in COVERT_INVITE_PHRASES order", () => {
    expect(detectCovertInvite("Revisa mi perfil y escribeme")).toEqual({
      matched: true,
      phrases: ["revisa mi perfil", "escribeme"],
    });
  });

  it("orders matches by the phrase list, not by input order", () => {
    // "escribeme" appears first in the text but is later in the list.
    expect(detectCovertInvite("Escribeme, revisa mi perfil")).toEqual({
      matched: true,
      phrases: ["revisa mi perfil", "escribeme"],
    });
  });

  it("collapses internal whitespace before matching", () => {
    expect(detectCovertInvite("mira\n\tmi   bio")).toEqual({
      matched: true,
      phrases: ["mira mi bio"],
    });
  });

  it("does not flag a partial phrase", () => {
    expect(detectCovertInvite("mira mi gato")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectCovertInvite("Hola, buenos dias a todos")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectCovertInvite(undefined)).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles the empty string", () => {
    expect(detectCovertInvite("")).toEqual({ matched: false, phrases: [] });
  });

  it("handles whitespace-only text", () => {
    expect(detectCovertInvite("    ")).toEqual({ matched: false, phrases: [] });
  });

  it("is deterministic for identical inputs", () => {
    const input = "revisa mi perfil, escribeme";
    expect(detectCovertInvite(input)).toEqual(detectCovertInvite(input));
  });

  it("exposes a non-empty, lowercase, accent-free phrase list", () => {
    expect(COVERT_INVITE_PHRASES.length).toBeGreaterThan(0);
    for (const phrase of COVERT_INVITE_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
      expect(/[̀-ͯ]/.test(phrase.normalize("NFD"))).toBe(false);
    }
  });
});
