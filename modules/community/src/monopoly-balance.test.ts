import { describe, expect, it } from "vitest";
import {
  type MonopolyUserStat,
  participationSpread,
  suggestQuietVoices,
} from "./monopoly-balance.js";

const stat = (userId: string, messages: number): MonopolyUserStat => ({
  userId,
  messages,
});

describe("suggestQuietVoices", () => {
  it("returns the least active users in ascending order", () => {
    const stats = [stat("a", 10), stat("b", 2), stat("c", 5)];
    expect(suggestQuietVoices(stats, 2)).toEqual(["b", "c"]);
  });

  it("orders all users ascending when topN covers everyone", () => {
    const stats = [stat("a", 9), stat("b", 1), stat("c", 4)];
    expect(suggestQuietVoices(stats, 3)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by stable first-appearance order", () => {
    const stats = [stat("x", 3), stat("y", 3), stat("z", 3)];
    expect(suggestQuietVoices(stats, 3)).toEqual(["x", "y", "z"]);
  });

  it("mixes ties and distinct counts stably", () => {
    const stats = [stat("a", 2), stat("b", 1), stat("c", 2), stat("d", 1)];
    expect(suggestQuietVoices(stats, 4)).toEqual(["b", "d", "a", "c"]);
  });

  it("excludes users with 0 messages when others have activity", () => {
    const stats = [stat("a", 0), stat("b", 3), stat("c", 0), stat("d", 1)];
    expect(suggestQuietVoices(stats, 4)).toEqual(["d", "b"]);
  });

  it("falls back to 0-message users when nobody else has activity", () => {
    const stats = [stat("a", 0), stat("b", 0), stat("c", 0)];
    expect(suggestQuietVoices(stats, 2)).toEqual(["a", "b"]);
  });

  it("treats negative message counts as 0 (excluded when others active)", () => {
    const stats = [stat("a", -5), stat("b", 4)];
    expect(suggestQuietVoices(stats, 2)).toEqual(["b"]);
  });

  it("uses negative-as-0 users as fallback when all are non-positive", () => {
    const stats = [stat("a", -5), stat("b", 0), stat("c", -1)];
    expect(suggestQuietVoices(stats, 3)).toEqual(["a", "b", "c"]);
  });

  it("clamps topN to the available candidates", () => {
    const stats = [stat("a", 1), stat("b", 2)];
    expect(suggestQuietVoices(stats, 10)).toEqual(["a", "b"]);
  });

  it("returns [] for topN of 0", () => {
    expect(suggestQuietVoices([stat("a", 1)], 0)).toEqual([]);
  });

  it("returns [] for negative topN", () => {
    expect(suggestQuietVoices([stat("a", 1)], -3)).toEqual([]);
  });

  it("returns [] for empty stats", () => {
    expect(suggestQuietVoices([], 5)).toEqual([]);
  });

  it("returns a single least-active user for topN of 1", () => {
    const stats = [stat("a", 8), stat("b", 3), stat("c", 6)];
    expect(suggestQuietVoices(stats, 1)).toEqual(["b"]);
  });

  it("is deterministic across repeated calls", () => {
    const stats = [stat("a", 4), stat("b", 4), stat("c", 1)];
    const first = suggestQuietVoices(stats, 3);
    const second = suggestQuietVoices(stats, 3);
    expect(first).toEqual(second);
    expect(first).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const stats = [stat("a", 5), stat("b", 1)];
    const snapshot = [...stats];
    suggestQuietVoices(stats, 2);
    expect(stats).toEqual(snapshot);
  });
});

describe("participationSpread", () => {
  it("returns 1 when everyone talks equally", () => {
    const stats = [stat("a", 5), stat("b", 5), stat("c", 5)];
    expect(participationSpread(stats)).toBe(1);
  });

  it("returns min/max for uneven participation", () => {
    const stats = [stat("a", 2), stat("b", 8)];
    expect(participationSpread(stats)).toBe(0.25);
  });

  it("returns 0 when one user monopolizes and another is silent", () => {
    const stats = [stat("a", 10), stat("b", 0)];
    expect(participationSpread(stats)).toBe(0);
  });

  it("returns 1 for empty stats", () => {
    expect(participationSpread([])).toBe(1);
  });

  it("returns 1 when nobody has any messages", () => {
    const stats = [stat("a", 0), stat("b", 0)];
    expect(participationSpread(stats)).toBe(1);
  });

  it("treats negative counts as 0", () => {
    const stats = [stat("a", -4), stat("b", 8)];
    expect(participationSpread(stats)).toBe(0);
  });

  it("returns 1 for a single user with activity", () => {
    expect(participationSpread([stat("a", 7)])).toBe(1);
  });

  it("is deterministic across repeated calls", () => {
    const stats = [stat("a", 3), stat("b", 9), stat("c", 6)];
    expect(participationSpread(stats)).toBe(participationSpread(stats));
    expect(participationSpread(stats)).toBeCloseTo(1 / 3, 10);
  });
});
