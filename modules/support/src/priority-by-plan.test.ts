import { describe, expect, it } from "vitest";
import { prioritizeByPlan, type SupportTicket } from "./priority-by-plan.js";

describe("prioritizeByPlan", () => {
  it("orders tickets by plan weight when ages are equal", () => {
    const input: readonly SupportTicket[] = [
      { id: "a", plan: "free", ageMs: 0 },
      { id: "b", plan: "vip", ageMs: 0 },
      { id: "c", plan: "pro", ageMs: 0 },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "b", priority: 30 },
      { id: "c", priority: 20 },
      { id: "a", priority: 10 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(prioritizeByPlan([])).toEqual([]);
  });

  it("adds one bonus point per full waiting minute", () => {
    const input: readonly SupportTicket[] = [
      { id: "new", plan: "free", ageMs: 0 },
      { id: "old", plan: "free", ageMs: 5 * 60_000 },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "old", priority: 15 },
      { id: "new", priority: 10 },
    ]);
  });

  it("caps the age bonus so a lower plan never overtakes a higher one", () => {
    const input: readonly SupportTicket[] = [
      { id: "agedFree", plan: "free", ageMs: 1000 * 60_000 },
      { id: "freshPro", plan: "pro", ageMs: 0 },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "freshPro", priority: 20 },
      { id: "agedFree", priority: 19 },
    ]);
  });

  it("breaks priority ties by id ascending", () => {
    const input: readonly SupportTicket[] = [
      { id: "b", plan: "pro", ageMs: 0 },
      { id: "a", plan: "pro", ageMs: 0 },
      { id: "c", plan: "pro", ageMs: 0 },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "a", priority: 20 },
      { id: "b", priority: 20 },
      { id: "c", priority: 20 },
    ]);
  });

  it("clamps negative wait time to a zero age bonus", () => {
    const input: readonly SupportTicket[] = [
      { id: "z", plan: "pro", ageMs: -100_000 },
    ];
    expect(prioritizeByPlan(input)).toEqual([{ id: "z", priority: 20 }]);
  });

  it("treats non-finite wait time as a zero age bonus", () => {
    const input: readonly SupportTicket[] = [
      { id: "nan", plan: "vip", ageMs: Number.NaN },
      { id: "inf", plan: "free", ageMs: Number.POSITIVE_INFINITY },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "nan", priority: 30 },
      { id: "inf", priority: 10 },
    ]);
  });

  it("ranks vip over pro over free at an equal, non-trivial age", () => {
    const input: readonly SupportTicket[] = [
      { id: "p", plan: "pro", ageMs: 3 * 60_000 },
      { id: "v", plan: "vip", ageMs: 3 * 60_000 },
      { id: "f", plan: "free", ageMs: 3 * 60_000 },
    ];
    expect(prioritizeByPlan(input)).toEqual([
      { id: "v", priority: 33 },
      { id: "p", priority: 23 },
      { id: "f", priority: 13 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: readonly SupportTicket[] = [
      { id: "a", plan: "free", ageMs: 0 },
      { id: "b", plan: "vip", ageMs: 0 },
    ];
    prioritizeByPlan(input);
    expect(input.map((ticket) => ticket.id)).toEqual(["a", "b"]);
  });

  it("produces identical output across repeated calls", () => {
    const input: readonly SupportTicket[] = [
      { id: "t2", plan: "pro", ageMs: 2 * 60_000 },
      { id: "t1", plan: "vip", ageMs: 0 },
      { id: "t3", plan: "free", ageMs: 20 * 60_000 },
    ];
    expect(prioritizeByPlan(input)).toEqual(prioritizeByPlan(input));
  });
});
