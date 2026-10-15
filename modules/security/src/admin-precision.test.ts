import { describe, expect, it } from "vitest";
import { rankAdminPrecision } from "./admin-precision.js";

describe("rankAdminPrecision", () => {
  it("ranks admins by precision descending", () => {
    expect(
      rankAdminPrecision([
        { adminId: 1, confirmed: 5, reverted: 5 },
        { adminId: 2, confirmed: 9, reverted: 1 },
      ]),
    ).toEqual([
      { adminId: 2, precision: 0.9, total: 10 },
      { adminId: 1, precision: 0.5, total: 10 },
    ]);
  });

  it("breaks precision ties by adminId ascending", () => {
    expect(
      rankAdminPrecision([
        { adminId: 5, confirmed: 1, reverted: 1 },
        { adminId: 2, confirmed: 2, reverted: 2 },
      ]).map((entry) => entry.adminId),
    ).toEqual([2, 5]);
  });

  it("scores admins with no decisions as zero", () => {
    expect(
      rankAdminPrecision([{ adminId: 1, confirmed: 0, reverted: 0 }]),
    ).toEqual([{ adminId: 1, precision: 0, total: 0 }]);
  });

  it("returns empty for no admins", () => {
    expect(rankAdminPrecision([])).toEqual([]);
  });
});
