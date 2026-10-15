import { describe, expect, it } from "vitest";
import {
  buildShortenerSignal,
  classifyDomain,
  isKnownShortener,
  KNOWN_SHORTENERS,
  normalizeDomain,
  SHORTENER_SIGNAL_WEIGHT,
} from "./shortener-quarantine.js";

describe("KNOWN_SHORTENERS", () => {
  it("includes the expected shorteners from the spec", () => {
    for (const shortener of [
      "bit.ly",
      "tinyurl.com",
      "cutt.ly",
      "t.co",
      "goo.gl",
      "is.gd",
      "ow.ly",
      "rebrand.ly",
    ]) {
      expect(KNOWN_SHORTENERS.has(shortener)).toBe(true);
    }
  });
});

describe("normalizeDomain", () => {
  it("lowercases and trims surrounding whitespace", () => {
    expect(normalizeDomain("  BIT.LY  ")).toBe("bit.ly");
  });

  it("strips a leading www. prefix", () => {
    expect(normalizeDomain("www.Example.com")).toBe("example.com");
  });

  it("strips trailing dots (fully qualified domains)", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeDomain("   ")).toBe("");
  });
});

describe("isKnownShortener", () => {
  it("matches a known shortener exactly", () => {
    expect(isKnownShortener("t.co")).toBe(true);
  });

  it("matches a subdomain of a known shortener", () => {
    expect(isKnownShortener("links.bit.ly")).toBe(true);
  });

  it("matches case-insensitively and ignoring www.", () => {
    expect(isKnownShortener("WWW.TinyURL.com")).toBe(true);
  });

  it("does not match a regular domain", () => {
    expect(isKnownShortener("example.com")).toBe(false);
  });

  it("does not match a domain that merely contains a shortener substring", () => {
    expect(isKnownShortener("notbit.ly.evil.com")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isKnownShortener("   ")).toBe(false);
  });
});

describe("classifyDomain", () => {
  it("quarantines a known shortener even when seen before", () => {
    const result = classifyDomain("bit.ly", true);
    expect(result.action).toBe("quarantine");
    expect(result.reason).toContain("Acortador");
  });

  it("quarantines a shortener subdomain", () => {
    expect(classifyDomain("s.rebrand.ly", true).action).toBe("quarantine");
  });

  it("quarantines a new domain never seen before", () => {
    const result = classifyDomain("example.com", false);
    expect(result.action).toBe("quarantine");
    expect(result.reason).toContain("nuevo");
  });

  it("allows a known domain already seen and not a shortener", () => {
    const result = classifyDomain("example.com", true);
    expect(result.action).toBe("allow");
    expect(result.reason).toBe("Dominio conocido y ya revisado.");
  });

  it("quarantines an empty domain", () => {
    const result = classifyDomain("   ", true);
    expect(result.action).toBe("quarantine");
    expect(result.reason).toContain("vacío");
  });

  it("normalizes before classifying (www + case)", () => {
    expect(classifyDomain("WWW.Example.com", true).action).toBe("allow");
  });

  it("is deterministic for identical inputs", () => {
    expect(classifyDomain("goo.gl", false)).toEqual(
      classifyDomain("goo.gl", false),
    );
  });
});

describe("buildShortenerSignal", () => {
  it("marks present with a detail when quarantined", () => {
    const signal = buildShortenerSignal("bit.ly", true);
    expect(signal.present).toBe(true);
    expect(signal.key).toBe("shortener_quarantine");
    expect(signal.weight).toBe(SHORTENER_SIGNAL_WEIGHT);
    expect(signal.detail).toContain("Acortador");
  });

  it("omits the detail property entirely when allowed", () => {
    const signal = buildShortenerSignal("example.com", true);
    expect(signal.present).toBe(false);
    expect(signal.detail).toBeUndefined();
    expect(Object.hasOwn(signal, "detail")).toBe(false);
  });

  it("is present for a new domain", () => {
    expect(buildShortenerSignal("newsite.io", false).present).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(buildShortenerSignal("t.co", false)).toEqual(
      buildShortenerSignal("t.co", false),
    );
  });
});
