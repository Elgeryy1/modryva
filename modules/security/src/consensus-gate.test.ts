import { describe, expect, it } from "vitest";
import { requireConsensus } from "./consensus-gate.js";

describe("requireConsensus", () => {
  it("approves when two distinct staff approve (default threshold)", () => {
    expect(
      requireConsensus([
        { staffId: 1, approve: true },
        { staffId: 2, approve: true },
      ]),
    ).toEqual({ approved: true, approvals: 2, distinctVoters: 2 });
  });

  it("rejects a single approval under the default threshold of two", () => {
    expect(requireConsensus([{ staffId: 1, approve: true }])).toEqual({
      approved: false,
      approvals: 1,
      distinctVoters: 1,
    });
  });

  it("counts the same staff member only once", () => {
    expect(
      requireConsensus([
        { staffId: 7, approve: true },
        { staffId: 7, approve: true },
      ]),
    ).toEqual({ approved: false, approvals: 1, distinctVoters: 1 });
  });

  it("lets the last vote per staff win when a vote is reversed", () => {
    expect(
      requireConsensus([
        { staffId: 1, approve: true },
        { staffId: 1, approve: false },
      ]),
    ).toEqual({ approved: false, approvals: 0, distinctVoters: 1 });
  });

  it("counts a distinct voter even when they finally reject", () => {
    expect(
      requireConsensus([
        { staffId: 1, approve: true },
        { staffId: 2, approve: false },
      ]),
    ).toEqual({ approved: false, approvals: 1, distinctVoters: 2 });
  });

  it("returns an empty outcome for no votes", () => {
    expect(requireConsensus([])).toEqual({
      approved: false,
      approvals: 0,
      distinctVoters: 0,
    });
  });

  it("honors a custom minApprovals threshold", () => {
    expect(
      requireConsensus(
        [
          { staffId: 1, approve: true },
          { staffId: 2, approve: true },
          { staffId: 3, approve: true },
        ],
        { minApprovals: 3 },
      ),
    ).toEqual({ approved: true, approvals: 3, distinctVoters: 3 });
  });

  it("approves with a single vote when minApprovals is one", () => {
    expect(
      requireConsensus([{ staffId: 9, approve: true }], { minApprovals: 1 }),
    ).toEqual({ approved: true, approvals: 1, distinctVoters: 1 });
  });

  it("clamps a non-positive minApprovals so empty votes never approve", () => {
    expect(requireConsensus([], { minApprovals: 0 })).toEqual({
      approved: false,
      approvals: 0,
      distinctVoters: 0,
    });
  });

  it("is order-independent for the resulting counts", () => {
    const forward = requireConsensus([
      { staffId: 1, approve: true },
      { staffId: 2, approve: false },
      { staffId: 3, approve: true },
    ]);
    const reversed = requireConsensus([
      { staffId: 3, approve: true },
      { staffId: 2, approve: false },
      { staffId: 1, approve: true },
    ]);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual({
      approved: true,
      approvals: 2,
      distinctVoters: 3,
    });
  });
});
