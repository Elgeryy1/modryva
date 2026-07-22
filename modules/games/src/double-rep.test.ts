import { describe, expect, it } from "vitest";
import { applyDoubleRep } from "./double-rep.js";

describe("applyDoubleRep", () => {
  it("doubles useful actions during an active event", () => {
    expect(
      applyDoubleRep({
        basePoints: 10,
        isUsefulAction: true,
        eventActive: true,
      }),
    ).toEqual({ points: 20, doubled: true });
  });

  it("does not double when the event is inactive", () => {
    expect(
      applyDoubleRep({
        basePoints: 10,
        isUsefulAction: true,
        eventActive: false,
      }),
    ).toEqual({ points: 10, doubled: false });
  });

  it("does not double non-useful actions", () => {
    expect(
      applyDoubleRep({
        basePoints: 10,
        isUsefulAction: false,
        eventActive: true,
      }),
    ).toEqual({ points: 10, doubled: false });
  });

  it("handles zero base points", () => {
    expect(
      applyDoubleRep({
        basePoints: 0,
        isUsefulAction: true,
        eventActive: true,
      }),
    ).toEqual({ points: 0, doubled: true });
  });
});
