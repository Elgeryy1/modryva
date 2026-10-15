import { describe, expect, it } from "vitest";
import { classifyTopicVitality } from "./topic-vitality.js";

describe("classifyTopicVitality", () => {
  it("marks a topic with few messages as muerto regardless of conflicts", () => {
    expect(
      classifyTopicVitality([{ id: "a", messages: 1, conflicts: 5 }]),
    ).toEqual([{ id: "a", state: "muerto" }]);
  });

  it("treats exactly the message threshold as muerto (boundary)", () => {
    expect(
      classifyTopicVitality([{ id: "b", messages: 2, conflicts: 0 }]),
    ).toEqual([{ id: "b", state: "muerto" }]);
  });

  it("classifies a busy low-conflict topic as activo", () => {
    expect(
      classifyTopicVitality([{ id: "c", messages: 10, conflicts: 2 }]),
    ).toEqual([{ id: "c", state: "activo" }]);
  });

  it("classifies the conflict ratio boundary as conflictivo", () => {
    expect(
      classifyTopicVitality([{ id: "d", messages: 10, conflicts: 3 }]),
    ).toEqual([{ id: "d", state: "conflictivo" }]);
  });

  it("classifies a high-conflict topic as conflictivo", () => {
    expect(
      classifyTopicVitality([{ id: "e", messages: 3, conflicts: 3 }]),
    ).toEqual([{ id: "e", state: "conflictivo" }]);
  });

  it("uses just below the ratio boundary as activo", () => {
    expect(
      classifyTopicVitality([{ id: "f", messages: 10, conflicts: 2 }]),
    ).toEqual([{ id: "f", state: "activo" }]);
  });

  it("treats zero messages as muerto without dividing by zero", () => {
    expect(
      classifyTopicVitality([{ id: "g", messages: 0, conflicts: 0 }]),
    ).toEqual([{ id: "g", state: "muerto" }]);
  });

  it("returns an empty array for empty input", () => {
    expect(classifyTopicVitality([])).toEqual([]);
  });

  it("preserves input order across mixed states", () => {
    const input = [
      { id: "t1", messages: 1, conflicts: 0 },
      { id: "t2", messages: 20, conflicts: 1 },
      { id: "t3", messages: 8, conflicts: 4 },
    ] as const;
    expect(classifyTopicVitality(input)).toEqual([
      { id: "t1", state: "muerto" },
      { id: "t2", state: "activo" },
      { id: "t3", state: "conflictivo" },
    ]);
  });

  it("is deterministic for repeated calls with the same input", () => {
    const input = [
      { id: "x", messages: 5, conflicts: 2 },
      { id: "y", messages: 2, conflicts: 2 },
    ] as const;
    expect(classifyTopicVitality(input)).toEqual(classifyTopicVitality(input));
  });
});
