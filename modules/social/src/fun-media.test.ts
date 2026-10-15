import { describe, expect, it } from "vitest";
import {
  EXCLUSION_WINDOW,
  type FunMediaAsset,
  isServable,
  pickAsset,
  rememberSent,
} from "./fun-media.js";
import { sequenceRandom } from "./ports.js";

const asset = (
  id: string,
  overrides: Partial<FunMediaAsset> = {},
): FunMediaAsset => ({
  id,
  kind: "cat",
  source: "biblioteca propia",
  licence: "CC0",
  attribution: null,
  active: true,
  safetyStatus: "approved",
  ...overrides,
});

describe("isServable", () => {
  it("refuses anything without recorded provenance", () => {
    // The report makes source + licence mandatory (§8.2). Enforcing it here
    // means no future caller can forget.
    expect(isServable(asset("a", { source: "" }))).toBe(false);
    expect(isServable(asset("a", { licence: "  " }))).toBe(false);
  });

  it("refuses anything not reviewed", () => {
    expect(isServable(asset("a", { safetyStatus: "pending" }))).toBe(false);
    expect(isServable(asset("a", { safetyStatus: "rejected" }))).toBe(false);
  });

  it("refuses a deactivated asset", () => {
    expect(isServable(asset("a", { active: false }))).toBe(false);
  });

  it("accepts a complete, approved, active one", () => {
    expect(isServable(asset("a"))).toBe(true);
  });
});

describe("pickAsset", () => {
  it("says the library is empty instead of sending nothing", () => {
    expect(pickAsset([], "cat", [], sequenceRandom([0]))).toEqual({
      ok: false,
      reason: "empty-library",
    });
  });

  it("never serves an asset of the wrong kind", () => {
    const library = [asset("c1"), asset("d1", { kind: "dog" })];
    const picked = pickAsset(library, "dog", [], sequenceRandom([0]));
    expect(picked.ok && picked.asset.id).toBe("d1");
  });

  it("never serves an unprovenanced asset even when it is the only one", () => {
    const library = [asset("c1", { licence: "" })];
    expect(pickAsset(library, "cat", [], sequenceRandom([0]))).toEqual({
      ok: false,
      reason: "empty-library",
    });
  });

  it("avoids what the group has just seen", () => {
    const library = [asset("c1"), asset("c2"), asset("c3")];
    const picked = pickAsset(library, "cat", ["c1", "c2"], sequenceRandom([0]));
    expect(picked.ok && picked.asset.id).toBe("c3");
  });

  it("repeats rather than refusing when the library is small", () => {
    // A five-image library must not stop working after five uses.
    const library = [asset("c1"), asset("c2")];
    const picked = pickAsset(library, "cat", ["c1", "c2"], sequenceRandom([0]));
    expect(picked.ok).toBe(true);
    expect(picked.ok && picked.repeated).toBe(true);
  });

  it("reports repeated=false while there is still fresh material", () => {
    const library = [asset("c1"), asset("c2")];
    const picked = pickAsset(library, "cat", ["c1"], sequenceRandom([0]));
    expect(picked.ok && picked.repeated).toBe(false);
  });
});

describe("rememberSent", () => {
  it("moves an id to the end instead of storing it twice", () => {
    expect(rememberSent(["a", "b", "c"], "b")).toEqual(["a", "c", "b"]);
  });

  it("keeps the window bounded", () => {
    let window: readonly string[] = [];
    for (let i = 0; i < EXCLUSION_WINDOW * 3; i += 1) {
      window = rememberSent(window, `id-${i}`);
    }
    expect(window).toHaveLength(EXCLUSION_WINDOW);
    expect(window.at(-1)).toBe(`id-${EXCLUSION_WINDOW * 3 - 1}`);
  });
});
