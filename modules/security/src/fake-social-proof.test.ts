import { describe, expect, it } from "vitest";
import {
  detectFakeSocialProof,
  FAKE_SOCIAL_PROOF_PHRASES,
} from "./fake-social-proof.js";

describe("detectFakeSocialProof", () => {
  it("flags a single social-proof phrase", () => {
    expect(detectFakeSocialProof("Alguien dijo que esto es legit.")).toEqual({
      matched: true,
      phrases: ["es legit"],
    });
  });

  it("matches case-insensitively", () => {
    expect(detectFakeSocialProof("PAGO REAL, confirmado")).toEqual({
      matched: true,
      phrases: ["pago real"],
    });
  });

  it("matches ignoring accents", () => {
    expect(detectFakeSocialProof("Ya gané dinero con esto")).toEqual({
      matched: true,
      phrases: ["ya gane dinero"],
    });
  });

  it("returns matches in catalog order, not text order", () => {
    expect(
      detectFakeSocialProof("Es legit, pago real y ya gane dinero."),
    ).toEqual({
      matched: true,
      phrases: ["ya gane dinero", "pago real", "es legit"],
    });
  });

  it("deduplicates repeated phrases", () => {
    expect(detectFakeSocialProof("Es legit! Es legit, de nuevo.")).toEqual({
      matched: true,
      phrases: ["es legit"],
    });
  });

  it("detects a phrase that contains a percent sign", () => {
    expect(
      detectFakeSocialProof("Invitame, esto es 100% real de verdad"),
    ).toEqual({
      matched: true,
      phrases: ["100% real"],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectFakeSocialProof("Hola equipo, gran comunidad")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectFakeSocialProof(undefined)).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles an empty string", () => {
    expect(detectFakeSocialProof("")).toEqual({ matched: false, phrases: [] });
  });

  it("is deterministic and order-stable across calls", () => {
    const first = detectFakeSocialProof("es legit y pago real");
    const second = detectFakeSocialProof("es legit y pago real");
    expect(first).toEqual(second);
    expect(first).toEqual({
      matched: true,
      phrases: ["pago real", "es legit"],
    });
  });

  it("keeps the phrase catalog normalized, unique and non-overlapping", () => {
    expect(FAKE_SOCIAL_PROOF_PHRASES.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const phrase of FAKE_SOCIAL_PROOF_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
      expect(seen.has(phrase)).toBe(false);
      seen.add(phrase);
    }
    for (const a of FAKE_SOCIAL_PROOF_PHRASES) {
      for (const b of FAKE_SOCIAL_PROOF_PHRASES) {
        if (a !== b) {
          expect(a.includes(b)).toBe(false);
        }
      }
    }
  });
});
