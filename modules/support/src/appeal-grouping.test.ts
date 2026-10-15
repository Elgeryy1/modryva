import { describe, expect, it } from "vitest";
import { bucketAppealsByIncident } from "./appeal-grouping.js";

describe("bucketAppealsByIncident", () => {
  it("groups appeals by incident with distinct sorted users", () => {
    expect(
      bucketAppealsByIncident([
        { incidentId: "i1", userId: 3 },
        { incidentId: "i1", userId: 1 },
        { incidentId: "i2", userId: 5 },
      ]),
    ).toEqual([
      { incidentId: "i1", userIds: [1, 3], count: 2 },
      { incidentId: "i2", userIds: [5], count: 1 },
    ]);
  });

  it("counts repeated appeals but dedupes users", () => {
    expect(
      bucketAppealsByIncident([
        { incidentId: "i1", userId: 1 },
        { incidentId: "i1", userId: 1 },
      ]),
    ).toEqual([{ incidentId: "i1", userIds: [1], count: 2 }]);
  });

  it("sorts groups by count desc then incidentId asc", () => {
    expect(
      bucketAppealsByIncident([
        { incidentId: "b", userId: 1 },
        { incidentId: "a", userId: 1 },
        { incidentId: "a", userId: 2 },
      ]).map((group) => group.incidentId),
    ).toEqual(["a", "b"]);
  });

  it("returns empty for no appeals", () => {
    expect(bucketAppealsByIncident([])).toEqual([]);
  });
});
