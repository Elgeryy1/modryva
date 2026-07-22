import { describe, expect, it } from "vitest";
import { detectClanAbuse } from "./clan-abuse.js";

const one = (clanId: string, atMs: number) => ({ clanId, userId: 1, atMs });

describe("detectClanAbuse", () => {
  it("flags a clan bursting past the threshold", () => {
    expect(
      detectClanAbuse([
        one("x", 0),
        one("x", 1000),
        one("x", 2000),
        one("x", 3000),
        one("x", 4000),
      ]),
    ).toEqual([{ clanId: "x", burst: 5 }]);
  });

  it("does not flag bursts below the threshold", () => {
    expect(detectClanAbuse([one("x", 0), one("x", 1000)])).toEqual([]);
  });

  it("ignores completions spread beyond the window", () => {
    expect(
      detectClanAbuse([
        one("x", 0),
        one("x", 60001),
        one("x", 120002),
        one("x", 180003),
        one("x", 240004),
      ]),
    ).toEqual([]);
  });

  it("sorts flagged clans by burst desc then clanId asc", () => {
    const many = (clanId: string, count: number) =>
      Array.from({ length: count }, (_, i) => one(clanId, i * 1000));
    const result = detectClanAbuse([...many("b", 5), ...many("a", 6)]);
    expect(result.map((entry) => entry.clanId)).toEqual(["a", "b"]);
  });

  it("honors custom window and minBurst", () => {
    expect(
      detectClanAbuse([one("x", 0), one("x", 10), one("x", 20)], {
        windowMs: 100,
        minBurst: 3,
      }),
    ).toEqual([{ clanId: "x", burst: 3 }]);
  });
});
