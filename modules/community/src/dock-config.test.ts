import { describe, expect, it } from "vitest";
import { DEFAULT_DOCK, resolveDock, toggleFavorite } from "./dock-config.js";

describe("DEFAULT_DOCK", () => {
  it("contains the expected ids in order", () => {
    expect(DEFAULT_DOCK).toEqual([
      "hoy",
      "inbox",
      "usuarios",
      "juegos",
      "staff",
    ]);
  });
});

describe("resolveDock", () => {
  it("respects the admin order over the default order", () => {
    expect(
      resolveDock(
        ["staff", "hoy", "inbox"],
        ["hoy", "inbox", "usuarios", "juegos", "staff"],
      ),
    ).toEqual(["staff", "hoy", "inbox"]);
  });

  it("filters out ids that are not allowed", () => {
    expect(
      resolveDock(["hoy", "secreto", "inbox"], ["hoy", "inbox", "staff"]),
    ).toEqual(["hoy", "inbox"]);
  });

  it("removes duplicates keeping first appearance", () => {
    expect(
      resolveDock(
        ["hoy", "inbox", "hoy", "staff", "inbox"],
        ["hoy", "inbox", "staff"],
      ),
    ).toEqual(["hoy", "inbox", "staff"]);
  });

  it("falls back to the default dock filtered by allowed when overrides are empty", () => {
    expect(resolveDock([], ["inbox", "juegos", "staff"])).toEqual([
      "inbox",
      "juegos",
      "staff",
    ]);
  });

  it("falls back to the default dock when no override id is allowed", () => {
    expect(resolveDock(["secreto", "otro"], ["hoy", "usuarios"])).toEqual([
      "hoy",
      "usuarios",
    ]);
  });

  it("returns the full default dock in default order when overrides are empty and all allowed", () => {
    expect(resolveDock([], DEFAULT_DOCK)).toEqual([
      "hoy",
      "inbox",
      "usuarios",
      "juegos",
      "staff",
    ]);
  });

  it("returns empty when nothing is allowed", () => {
    expect(resolveDock(["hoy"], [])).toEqual([]);
    expect(resolveDock([], [])).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const overrides = ["staff", "hoy"];
    const allowed = ["hoy", "staff", "inbox"];
    expect(resolveDock(overrides, allowed)).toEqual(
      resolveDock(overrides, allowed),
    );
  });

  it("does not mutate its inputs", () => {
    const overrides = ["hoy", "inbox"];
    const allowed = ["hoy", "inbox", "staff"];
    resolveDock(overrides, allowed);
    expect(overrides).toEqual(["hoy", "inbox"]);
    expect(allowed).toEqual(["hoy", "inbox", "staff"]);
  });
});

describe("toggleFavorite", () => {
  it("adds a new favorite at the end when under the max", () => {
    expect(toggleFavorite(["hoy", "inbox"], "staff", 5)).toEqual([
      "hoy",
      "inbox",
      "staff",
    ]);
  });

  it("removes an existing favorite preserving the rest of the order", () => {
    expect(toggleFavorite(["hoy", "inbox", "staff"], "inbox", 5)).toEqual([
      "hoy",
      "staff",
    ]);
  });

  it("removes even when the max is already reached", () => {
    expect(toggleFavorite(["hoy", "inbox"], "hoy", 2)).toEqual(["inbox"]);
  });

  it("does not add when the max is already reached", () => {
    const favs = ["hoy", "inbox"];
    expect(toggleFavorite(favs, "staff", 2)).toBe(favs);
  });

  it("treats a max below 1 as zero, never adding", () => {
    const empty: readonly string[] = [];
    expect(toggleFavorite(empty, "hoy", 0)).toBe(empty);
    expect(toggleFavorite(empty, "hoy", -3)).toBe(empty);
  });

  it("still removes when max is zero", () => {
    expect(toggleFavorite(["hoy"], "hoy", 0)).toEqual([]);
  });

  it("adds to an empty list when max allows", () => {
    expect(toggleFavorite([], "hoy", 1)).toEqual(["hoy"]);
  });

  it("does not mutate the input array", () => {
    const favs = ["hoy", "inbox"];
    toggleFavorite(favs, "staff", 5);
    toggleFavorite(favs, "hoy", 5);
    expect(favs).toEqual(["hoy", "inbox"]);
  });

  it("is deterministic for identical inputs", () => {
    expect(toggleFavorite(["hoy"], "inbox", 3)).toEqual(
      toggleFavorite(["hoy"], "inbox", 3),
    );
  });
});
