import { describe, expect, it } from "vitest";
import { decideContentReputation } from "./content-reputation.js";

describe("decideContentReputation", () => {
  it("trusts content with enough approvals and no rejections", () => {
    expect(decideContentReputation({ approvals: 20, rejections: 0 })).toEqual({
      trusted: true,
      score: 20,
    });
  });

  it("does not trust content with any rejection", () => {
    expect(decideContentReputation({ approvals: 50, rejections: 1 })).toEqual({
      trusted: false,
      score: 49,
    });
  });

  it("does not trust content below the approval threshold", () => {
    expect(
      decideContentReputation({ approvals: 19, rejections: 0 }).trusted,
    ).toBe(false);
  });

  it("honors a custom minApprovals", () => {
    expect(
      decideContentReputation(
        { approvals: 5, rejections: 0 },
        {
          minApprovals: 5,
        },
      ).trusted,
    ).toBe(true);
  });

  it("computes a net score", () => {
    expect(
      decideContentReputation({ approvals: 10, rejections: 4 }).score,
    ).toBe(6);
  });
});
