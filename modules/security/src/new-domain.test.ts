import { describe, expect, it } from "vitest";
import { detectNewDomain, normalizeCandidateDomain } from "./new-domain.js";

describe("normalizeCandidateDomain", () => {
  it("lowercases, trims and strips a leading www.", () => {
    expect(normalizeCandidateDomain("  WWW.Example.COM  ")).toBe("example.com");
  });
  it("returns '' for undefined", () => {
    expect(normalizeCandidateDomain(undefined)).toBe("");
  });
  it("returns '' for empty string", () => {
    expect(normalizeCandidateDomain("")).toBe("");
  });
  it("keeps domains without a www. prefix intact", () => {
    expect(normalizeCandidateDomain("Sub.Example.com")).toBe("sub.example.com");
  });
});

describe("detectNewDomain", () => {
  it("flags a domain absent from the seen set as new", () => {
    expect(detectNewDomain("Example.com", [])).toEqual({
      isNew: true,
      normalized: "example.com",
    });
  });
  it("treats www and non-www variants as the same domain", () => {
    expect(detectNewDomain("www.Example.com", ["example.com"])).toEqual({
      isNew: false,
      normalized: "example.com",
    });
  });
  it("matches when the seen entry carries the www. prefix", () => {
    expect(detectNewDomain("test.com", ["WWW.Test.com"])).toEqual({
      isNew: false,
      normalized: "test.com",
    });
  });
  it("returns not-new and empty normalized for undefined", () => {
    expect(detectNewDomain(undefined, ["a.com"])).toEqual({
      isNew: false,
      normalized: "",
    });
  });
  it("returns not-new and empty normalized for empty string", () => {
    expect(detectNewDomain("", ["a.com"])).toEqual({
      isNew: false,
      normalized: "",
    });
  });
  it("is new when a similar but distinct domain was seen", () => {
    expect(detectNewDomain("evil.com", ["good.com", "safe.org"])).toEqual({
      isNew: true,
      normalized: "evil.com",
    });
  });
  it("produces identical results across repeated calls (determinism)", () => {
    const seen: readonly string[] = ["one.com", "two.com"];
    const first = detectNewDomain("Three.com", seen);
    const second = detectNewDomain("Three.com", seen);
    expect(first).toEqual(second);
    expect(first).toEqual({ isNew: true, normalized: "three.com" });
  });
});
