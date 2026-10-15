import { describe, expect, it } from "vitest";
import { groupSimilarReports, normalizeReason } from "./batch-resolve.js";

describe("normalizeReason", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalizeReason("  Spám  ")).toBe("spam");
  });
  it("collapses inner whitespace", () => {
    expect(normalizeReason("Acoso   grave")).toBe("acoso grave");
  });
  it("strips the enye tilde", () => {
    expect(normalizeReason("ENGAÑO")).toBe("engano");
  });
});

describe("groupSimilarReports", () => {
  it("clusters reports by normalized reason", () => {
    expect(
      groupSimilarReports([
        { id: "1", reason: "Spam" },
        { id: "2", reason: "spam" },
        { id: "3", reason: "Acoso" },
      ]),
    ).toEqual([
      { reason: "spam", ids: ["1", "2"], count: 2 },
      { reason: "acoso", ids: ["3"], count: 1 },
    ]);
  });

  it("treats accented and unaccented reasons as the same group", () => {
    expect(
      groupSimilarReports([
        { id: "a", reason: "Engaño" },
        { id: "b", reason: "engano" },
      ]),
    ).toEqual([{ reason: "engano", ids: ["a", "b"], count: 2 }]);
  });

  it("sorts groups by count descending", () => {
    const result = groupSimilarReports([
      { id: "1", reason: "spam" },
      { id: "2", reason: "acoso" },
      { id: "3", reason: "spam" },
      { id: "4", reason: "spam" },
    ]);
    expect(result.map((g) => g.reason)).toEqual(["spam", "acoso"]);
    expect(result[0]?.count).toBe(3);
  });

  it("breaks count ties by reason ascending", () => {
    const result = groupSimilarReports([
      { id: "1", reason: "spam" },
      { id: "2", reason: "acoso" },
    ]);
    expect(result).toEqual([
      { reason: "acoso", ids: ["2"], count: 1 },
      { reason: "spam", ids: ["1"], count: 1 },
    ]);
  });

  it("preserves input order for ids within a group", () => {
    const result = groupSimilarReports([
      { id: "z", reason: "spam" },
      { id: "m", reason: "spam" },
      { id: "a", reason: "spam" },
    ]);
    expect(result[0]?.ids).toEqual(["z", "m", "a"]);
  });

  it("returns an empty list for empty input", () => {
    expect(groupSimilarReports([])).toEqual([]);
  });

  it("groups reports with empty or whitespace-only reasons together", () => {
    expect(
      groupSimilarReports([
        { id: "1", reason: "" },
        { id: "2", reason: "   " },
      ]),
    ).toEqual([{ reason: "", ids: ["1", "2"], count: 2 }]);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { id: "1", reason: "Spam" },
      { id: "2", reason: "acoso" },
      { id: "3", reason: "SPAM" },
    ] as const;
    expect(groupSimilarReports(input)).toEqual(groupSimilarReports(input));
  });
});
