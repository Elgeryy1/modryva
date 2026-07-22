import { describe, expect, it } from "vitest";
import { detectExternalPromotions } from "./external-admin.js";

describe("detectExternalPromotions", () => {
  it("flags an admin promoted outside the known set", () => {
    expect(detectExternalPromotions([1, 2], [1, 2, 3])).toEqual({
      newAdmins: [3],
      alert: true,
    });
  });

  it("returns no alert when current admins match the known set", () => {
    expect(detectExternalPromotions([1, 2, 3], [1, 2, 3])).toEqual({
      newAdmins: [],
      alert: false,
    });
  });

  it("ignores known admins that are no longer present", () => {
    expect(detectExternalPromotions([1, 2, 3], [1, 2])).toEqual({
      newAdmins: [],
      alert: false,
    });
  });

  it("sorts new admins ascending regardless of input order", () => {
    expect(detectExternalPromotions([1], [9, 3, 7])).toEqual({
      newAdmins: [3, 7, 9],
      alert: true,
    });
  });

  it("deduplicates repeated external admins", () => {
    expect(detectExternalPromotions([1], [5, 5, 5, 2])).toEqual({
      newAdmins: [2, 5],
      alert: true,
    });
  });

  it("treats every current admin as external when known is empty", () => {
    expect(detectExternalPromotions([], [4, 1])).toEqual({
      newAdmins: [1, 4],
      alert: true,
    });
  });

  it("returns no alert for empty current admins", () => {
    expect(detectExternalPromotions([1, 2], [])).toEqual({
      newAdmins: [],
      alert: false,
    });
  });

  it("returns no alert when both sets are empty", () => {
    expect(detectExternalPromotions([], [])).toEqual({
      newAdmins: [],
      alert: false,
    });
  });

  it("handles negative ids and sorts them correctly", () => {
    expect(detectExternalPromotions([0], [-5, 3, -1])).toEqual({
      newAdmins: [-5, -1, 3],
      alert: true,
    });
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const first = detectExternalPromotions([10], [30, 20, 30, 40]);
    const second = detectExternalPromotions([10], [30, 20, 30, 40]);
    expect(first).toEqual(second);
    expect(first).toEqual({ newAdmins: [20, 30, 40], alert: true });
  });
});
