import { describe, expect, it } from "vitest";
import { detectAggressiveAdmins } from "./aggressive-admin.js";

describe("detectAggressiveAdmins", () => {
  it("flags an admin whose sanctions exceed avg * default factor", () => {
    const result = detectAggressiveAdmins([
      { adminId: 1, sanctions: 10 },
      { adminId: 2, sanctions: 2 },
      { adminId: 3, sanctions: 0 },
    ]);
    // avg = 12 / 3 = 4, threshold = 8; only admin 1 (10) qualifies, 10/4 = 2.5
    expect(result).toEqual([{ adminId: 1, sanctions: 10, ratioToAvg: 2.5 }]);
  });

  it("returns an empty list for empty input", () => {
    expect(detectAggressiveAdmins([])).toEqual([]);
  });

  it("returns an empty list when the average is zero", () => {
    expect(
      detectAggressiveAdmins([
        { adminId: 1, sanctions: 0 },
        { adminId: 2, sanctions: 0 },
      ]),
    ).toEqual([]);
  });

  it("does not flag a single admin under the default factor", () => {
    // avg = 5, threshold = 10, sanctions 5 < 10
    expect(detectAggressiveAdmins([{ adminId: 7, sanctions: 5 }])).toEqual([]);
  });

  it("sorts flagged admins by sanctions descending", () => {
    const result = detectAggressiveAdmins(
      [
        { adminId: 1, sanctions: 5 },
        { adminId: 2, sanctions: 3 },
        { adminId: 3, sanctions: 1 },
      ],
      { factor: 1 },
    );
    // avg = 9 / 3 = 3, threshold = 3; admin1 (5, 1.67) and admin2 (3, 1) qualify
    expect(result).toEqual([
      { adminId: 1, sanctions: 5, ratioToAvg: 1.67 },
      { adminId: 2, sanctions: 3, ratioToAvg: 1 },
    ]);
  });

  it("breaks sanction ties by adminId ascending", () => {
    const result = detectAggressiveAdmins([
      { adminId: 2, sanctions: 10 },
      { adminId: 1, sanctions: 10 },
      { adminId: 3, sanctions: 0 },
      { adminId: 4, sanctions: 0 },
      { adminId: 5, sanctions: 0 },
      { adminId: 6, sanctions: 0 },
    ]);
    // avg = 20 / 6 = 3.3333, threshold = 6.6667; both 10s qualify, 10/avg = 3
    expect(result).toEqual([
      { adminId: 1, sanctions: 10, ratioToAvg: 3 },
      { adminId: 2, sanctions: 10, ratioToAvg: 3 },
    ]);
  });

  it("honours a custom factor to widen the flag threshold", () => {
    const admins = [
      { adminId: 1, sanctions: 8 },
      { adminId: 2, sanctions: 4 },
    ];
    // avg = 6; factor 2 -> threshold 12 -> nobody flagged
    expect(detectAggressiveAdmins(admins, { factor: 2 })).toEqual([]);
  });

  it("rounds ratioToAvg to 2 decimals", () => {
    const result = detectAggressiveAdmins(
      [
        { adminId: 1, sanctions: 5 },
        { adminId: 2, sanctions: 1 },
      ],
      { factor: 1 },
    );
    // avg = 3, threshold 3; admin1 5/3 = 1.6666... -> 1.67
    expect(result).toEqual([{ adminId: 1, sanctions: 5, ratioToAvg: 1.67 }]);
  });

  it("is deterministic across repeated calls", () => {
    const admins = [
      { adminId: 3, sanctions: 20 },
      { adminId: 1, sanctions: 20 },
      { adminId: 2, sanctions: 1 },
    ];
    const first = detectAggressiveAdmins(admins, { factor: 1 });
    const second = detectAggressiveAdmins(admins, { factor: 1 });
    expect(first).toEqual(second);
  });
});
