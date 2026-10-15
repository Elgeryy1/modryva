import { describe, expect, it } from "vitest";
import { summarizeAcceptedAppeals } from "./accepted-appeals-report.js";

describe("summarizeAcceptedAppeals", () => {
  it("counts accepted appeals per rule and ignores rejected ones", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: true, rule: "spam" },
      { accepted: true, rule: "spam" },
      { accepted: false, rule: "spam" },
      { accepted: true, rule: "flood" },
      { accepted: true, rule: "links" },
      { accepted: true, rule: "flood" },
    ]);
    expect(report).toEqual({
      acceptedTotal: 5,
      byRule: [
        { rule: "flood", count: 2 },
        { rule: "spam", count: 2 },
        { rule: "links", count: 1 },
      ],
    });
  });

  it("sorts rules by count descending", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: true, rule: "a" },
      { accepted: true, rule: "b" },
      { accepted: true, rule: "b" },
      { accepted: true, rule: "b" },
      { accepted: true, rule: "c" },
      { accepted: true, rule: "c" },
    ]);
    expect(report.byRule).toEqual([
      { rule: "b", count: 3 },
      { rule: "c", count: 2 },
      { rule: "a", count: 1 },
    ]);
    expect(report.acceptedTotal).toBe(6);
  });

  it("breaks count ties by rule ascending", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: true, rule: "charlie" },
      { accepted: true, rule: "alpha" },
      { accepted: true, rule: "bravo" },
    ]);
    expect(report.byRule).toEqual([
      { rule: "alpha", count: 1 },
      { rule: "bravo", count: 1 },
      { rule: "charlie", count: 1 },
    ]);
  });

  it("returns an empty report for empty input", () => {
    expect(summarizeAcceptedAppeals([])).toEqual({
      acceptedTotal: 0,
      byRule: [],
    });
  });

  it("returns an empty report when every appeal is rejected", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: false, rule: "spam" },
      { accepted: false, rule: "flood" },
    ]);
    expect(report).toEqual({ acceptedTotal: 0, byRule: [] });
  });

  it("handles a single accepted appeal", () => {
    expect(
      summarizeAcceptedAppeals([{ accepted: true, rule: "raid" }]),
    ).toEqual({ acceptedTotal: 1, byRule: [{ rule: "raid", count: 1 }] });
  });

  it("treats distinct rule casing as separate rules and orders by codepoint", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: true, rule: "spam" },
      { accepted: true, rule: "Spam" },
    ]);
    expect(report.byRule).toEqual([
      { rule: "Spam", count: 1 },
      { rule: "spam", count: 1 },
    ]);
  });

  it("keeps acceptedTotal equal to the sum of byRule counts", () => {
    const report = summarizeAcceptedAppeals([
      { accepted: true, rule: "a" },
      { accepted: true, rule: "a" },
      { accepted: false, rule: "a" },
      { accepted: true, rule: "b" },
    ]);
    const sum = report.byRule.reduce((acc, entry) => acc + entry.count, 0);
    expect(report.acceptedTotal).toBe(sum);
    expect(report.acceptedTotal).toBe(3);
  });

  it("is deterministic and does not mutate its input", () => {
    const input = [
      { accepted: true, rule: "b" },
      { accepted: true, rule: "a" },
      { accepted: true, rule: "b" },
    ];
    const snapshot = [
      { accepted: true, rule: "b" },
      { accepted: true, rule: "a" },
      { accepted: true, rule: "b" },
    ];
    const first = summarizeAcceptedAppeals(input);
    const second = summarizeAcceptedAppeals(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      acceptedTotal: 3,
      byRule: [
        { rule: "b", count: 2 },
        { rule: "a", count: 1 },
      ],
    });
    expect(input).toEqual(snapshot);
  });
});
