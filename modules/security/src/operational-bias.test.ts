import { describe, expect, it } from "vitest";
import { detectOperationalBias } from "./operational-bias.js";

describe("detectOperationalBias", () => {
  it("flags a strong anti-newcomer bias", () => {
    expect(
      detectOperationalBias({
        newSanctions: 30,
        newMembers: 100,
        veteranSanctions: 5,
        veteranMembers: 100,
      }),
    ).toEqual({ newRate: 0.3, veteranRate: 0.05, biased: true });
  });

  it("does not flag balanced sanctioning", () => {
    expect(
      detectOperationalBias({
        newSanctions: 5,
        newMembers: 100,
        veteranSanctions: 4,
        veteranMembers: 100,
      }).biased,
    ).toBe(false);
  });

  it("guards zero populations", () => {
    expect(
      detectOperationalBias({
        newSanctions: 0,
        newMembers: 0,
        veteranSanctions: 0,
        veteranMembers: 0,
      }),
    ).toEqual({ newRate: 0, veteranRate: 0, biased: false });
  });

  it("does not flag when veterans are sanctioned more", () => {
    expect(
      detectOperationalBias({
        newSanctions: 1,
        newMembers: 100,
        veteranSanctions: 20,
        veteranMembers: 100,
      }).biased,
    ).toBe(false);
  });
});
