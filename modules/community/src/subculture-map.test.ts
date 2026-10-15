import { describe, expect, it } from "vitest";
import {
  clusterSubcultures,
  type Subculture,
  type TaggedUser,
} from "./subculture-map.js";

const user = (userId: string, tags: readonly string[]): TaggedUser => ({
  userId,
  tags,
});

describe("clusterSubcultures", () => {
  it("returns empty for no users", () => {
    expect(clusterSubcultures([], 1)).toEqual([]);
  });

  it("returns empty when no tag reaches minShared", () => {
    const users = [user("a", ["metal"]), user("b", ["jazz"])];
    expect(clusterSubcultures(users, 2)).toEqual([]);
  });

  it("groups users sharing a tag", () => {
    const users = [
      user("a", ["metal", "cine"]),
      user("b", ["metal"]),
      user("c", ["cine"]),
    ];
    const result = clusterSubcultures(users, 2);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "cine", members: ["a", "c"] },
      { tag: "metal", members: ["a", "b"] },
    ]);
  });

  it("orders subcultures by member count descending", () => {
    const users = [
      user("a", ["big", "small"]),
      user("b", ["big"]),
      user("c", ["big", "small"]),
    ];
    const result = clusterSubcultures(users, 1);
    expect(result.map((s) => s.tag)).toEqual(["big", "small"]);
    expect(result[0]?.members).toEqual(["a", "b", "c"]);
    expect(result[1]?.members).toEqual(["a", "c"]);
  });

  it("breaks size ties by tag ascending", () => {
    const users = [user("a", ["zeta", "alfa"]), user("b", ["zeta", "alfa"])];
    const result = clusterSubcultures(users, 2);
    expect(result.map((s) => s.tag)).toEqual(["alfa", "zeta"]);
  });

  it("preserves first-appearance order of members", () => {
    const users = [user("c", ["x"]), user("a", ["x"]), user("b", ["x"])];
    const result = clusterSubcultures(users, 1);
    expect(result[0]?.members).toEqual(["c", "a", "b"]);
  });

  it("counts a repeated tag within one user only once", () => {
    const users = [user("a", ["metal", "metal", "metal"])];
    const result = clusterSubcultures(users, 1);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "metal", members: ["a"] },
    ]);
  });

  it("counts a duplicated userId only once per tag", () => {
    const users = [
      user("a", ["metal"]),
      user("a", ["metal"]),
      user("b", ["metal"]),
    ];
    const result = clusterSubcultures(users, 1);
    expect(result[0]?.members).toEqual(["a", "b"]);
  });

  it("includes every tag when minShared is 0", () => {
    const users = [user("a", ["solo"])];
    const result = clusterSubcultures(users, 0);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "solo", members: ["a"] },
    ]);
  });

  it("includes every tag when minShared is negative", () => {
    const users = [user("a", ["solo"])];
    const result = clusterSubcultures(users, -3);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "solo", members: ["a"] },
    ]);
  });

  it("ignores users with no tags", () => {
    const users = [user("a", []), user("b", ["metal"]), user("c", ["metal"])];
    const result = clusterSubcultures(users, 2);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "metal", members: ["b", "c"] },
    ]);
  });

  it("filters out tags below minShared while keeping others", () => {
    const users = [
      user("a", ["metal", "raro"]),
      user("b", ["metal"]),
      user("c", ["metal"]),
    ];
    const result = clusterSubcultures(users, 2);
    expect(result).toEqual<readonly Subculture[]>([
      { tag: "metal", members: ["a", "b", "c"] },
    ]);
  });

  it("treats tags case-sensitively", () => {
    const users = [user("a", ["Metal"]), user("b", ["metal"])];
    const result = clusterSubcultures(users, 1);
    expect(result.map((s) => s.tag).sort()).toEqual(["Metal", "metal"]);
    expect(result).toHaveLength(2);
  });

  it("is deterministic for identical inputs", () => {
    const users = [
      user("a", ["x", "y"]),
      user("b", ["y", "z"]),
      user("c", ["x", "z"]),
    ];
    expect(clusterSubcultures(users, 1)).toEqual(clusterSubcultures(users, 1));
  });

  it("handles several tags with mixed sizes and ties", () => {
    const users = [
      user("a", ["gaming", "anime", "cocina"]),
      user("b", ["gaming", "anime"]),
      user("c", ["gaming"]),
      user("d", ["anime"]),
    ];
    const result = clusterSubcultures(users, 1);
    expect(result.map((s) => s.tag)).toEqual(["anime", "gaming", "cocina"]);
    expect(result[0]?.members).toEqual(["a", "b", "d"]);
    expect(result[1]?.members).toEqual(["a", "b", "c"]);
    expect(result[2]?.members).toEqual(["a"]);
  });

  it("returns members as independent arrays per tag", () => {
    const users = [user("a", ["one", "two"]), user("b", ["one"])];
    const result = clusterSubcultures(users, 1);
    const one = result.find((s) => s.tag === "one");
    const two = result.find((s) => s.tag === "two");
    expect(one?.members).toEqual(["a", "b"]);
    expect(two?.members).toEqual(["a"]);
  });
});
