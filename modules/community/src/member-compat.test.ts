import { describe, expect, it } from "vitest";
import { suggestConnections } from "./member-compat.js";

describe("suggestConnections", () => {
  it("ranks pairs by shared count desc then pair asc", () => {
    const result = suggestConnections([
      { userId: 5, interests: ["a", "b", "c", "d"] },
      { userId: 3, interests: ["a", "b", "c"] },
      { userId: 8, interests: ["a", "b"] },
      { userId: 1, interests: ["x", "y"] },
    ]);
    expect(result).toEqual([
      { pair: [3, 5], shared: 3 },
      { pair: [3, 8], shared: 2 },
      { pair: [5, 8], shared: 2 },
    ]);
  });

  it("defaults minShared to 2 and drops weaker overlaps", () => {
    const result = suggestConnections([
      { userId: 1, interests: ["a", "b"] },
      { userId: 2, interests: ["a"] },
    ]);
    expect(result).toEqual([]);
  });

  it("respects a higher custom minShared", () => {
    const result = suggestConnections(
      [
        { userId: 5, interests: ["a", "b", "c", "d"] },
        { userId: 3, interests: ["a", "b", "c"] },
        { userId: 8, interests: ["a", "b"] },
      ],
      { minShared: 3 },
    );
    expect(result).toEqual([{ pair: [3, 5], shared: 3 }]);
  });

  it("includes weak overlaps when minShared is 1", () => {
    const result = suggestConnections(
      [
        { userId: 2, interests: ["a", "b"] },
        { userId: 7, interests: ["b", "c"] },
      ],
      { minShared: 1 },
    );
    expect(result).toEqual([{ pair: [2, 7], shared: 1 }]);
  });

  it("matches interests case-insensitively and trims whitespace", () => {
    const result = suggestConnections([
      { userId: 1, interests: ["  Tech ", "Music"] },
      { userId: 2, interests: ["tech", "MUSIC", "art"] },
    ]);
    expect(result).toEqual([{ pair: [1, 2], shared: 2 }]);
  });

  it("counts each shared interest once despite duplicates", () => {
    const result = suggestConnections([
      { userId: 1, interests: ["a", "a", "b"] },
      { userId: 2, interests: ["a", "b", "b"] },
    ]);
    expect(result).toEqual([{ pair: [1, 2], shared: 2 }]);
  });

  it("ignores blank interest entries", () => {
    const result = suggestConnections([
      { userId: 1, interests: ["a", "   ", "b"] },
      { userId: 2, interests: ["a", "b", ""] },
    ]);
    expect(result).toEqual([{ pair: [1, 2], shared: 2 }]);
  });

  it("returns an empty array for no members", () => {
    expect(suggestConnections([])).toEqual([]);
  });

  it("returns an empty array for a single member", () => {
    expect(suggestConnections([{ userId: 1, interests: ["a", "b"] }])).toEqual(
      [],
    );
  });

  it("returns an empty array when members have empty interests", () => {
    const result = suggestConnections([
      { userId: 1, interests: [] },
      { userId: 2, interests: [] },
    ]);
    expect(result).toEqual([]);
  });

  it("normalizes each pair to [min, max] regardless of input order", () => {
    const result = suggestConnections([
      { userId: 9, interests: ["a", "b"] },
      { userId: 2, interests: ["a", "b"] },
    ]);
    expect(result).toEqual([{ pair: [2, 9], shared: 2 }]);
  });

  it("treats an undefined options argument as defaults", () => {
    const result = suggestConnections(
      [
        { userId: 1, interests: ["a", "b"] },
        { userId: 2, interests: ["a", "b", "c"] },
      ],
      undefined,
    );
    expect(result).toEqual([{ pair: [1, 2], shared: 2 }]);
  });
});
