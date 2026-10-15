import { describe, expect, it } from "vitest";
import { computeSocialStability } from "./social-stability.js";

describe("computeSocialStability", () => {
  it("scores a conflict-free active group as fully stable", () => {
    expect(
      computeSocialStability({
        conflicts: 0,
        resolutions: 0,
        activeMembers: 10,
      }),
    ).toEqual({ score: 100, band: "estable" });
  });

  it("scores fully resolved conflicts with low density as stable", () => {
    expect(
      computeSocialStability({
        conflicts: 10,
        resolutions: 10,
        activeMembers: 100,
      }),
    ).toEqual({ score: 96, band: "estable" });
  });

  it("scores unresolved high-density conflicts as unstable", () => {
    expect(
      computeSocialStability({
        conflicts: 10,
        resolutions: 0,
        activeMembers: 5,
      }),
    ).toEqual({ score: 0, band: "inestable" });
  });

  it("scores half-resolved max-density conflicts as unstable", () => {
    expect(
      computeSocialStability({
        conflicts: 10,
        resolutions: 5,
        activeMembers: 10,
      }),
    ).toEqual({ score: 30, band: "inestable" });
  });

  it("scores a mid case as fragile", () => {
    expect(
      computeSocialStability({
        conflicts: 10,
        resolutions: 5,
        activeMembers: 20,
      }),
    ).toEqual({ score: 50, band: "fragil" });
  });

  it("rounds up to the stable threshold at the boundary", () => {
    expect(
      computeSocialStability({
        conflicts: 10,
        resolutions: 5,
        activeMembers: 1000,
      }),
    ).toEqual({ score: 70, band: "estable" });
  });

  it("caps the resolution ratio when resolutions exceed conflicts", () => {
    expect(
      computeSocialStability({
        conflicts: 5,
        resolutions: 20,
        activeMembers: 50,
      }),
    ).toEqual({ score: 96, band: "estable" });
  });

  it("treats a group with no active members as unstable", () => {
    expect(
      computeSocialStability({
        conflicts: 3,
        resolutions: 3,
        activeMembers: 0,
      }),
    ).toEqual({ score: 0, band: "inestable" });
  });

  it("clamps negative inputs and reports an unstable empty group", () => {
    expect(
      computeSocialStability({
        conflicts: -5,
        resolutions: -3,
        activeMembers: -10,
      }),
    ).toEqual({ score: 0, band: "inestable" });
  });

  it("scores good resolution and low density as stable", () => {
    expect(
      computeSocialStability({
        conflicts: 4,
        resolutions: 3,
        activeMembers: 20,
      }),
    ).toEqual({ score: 77, band: "estable" });
  });

  it("is deterministic for repeated calls", () => {
    const input = { conflicts: 7, resolutions: 4, activeMembers: 30 } as const;
    expect(computeSocialStability(input)).toEqual(
      computeSocialStability(input),
    );
  });
});
