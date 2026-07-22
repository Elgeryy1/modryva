import { describe, expect, it } from "vitest";
import {
  addMissionProgress,
  type CoopMission,
  coopMissionIsComplete,
  coopMissionRemaining,
  missionPercent,
  streakBonus,
} from "./coop-missions.js";

const mission = (goal: number, progress: number): CoopMission => ({
  goal,
  progress,
});

describe("coopMissionIsComplete", () => {
  it("is false while progress is below the goal", () => {
    expect(coopMissionIsComplete(mission(100, 99))).toBe(false);
  });

  it("is true when progress reaches the goal", () => {
    expect(coopMissionIsComplete(mission(100, 100))).toBe(true);
  });

  it("is true when progress exceeds the goal", () => {
    expect(coopMissionIsComplete(mission(100, 150))).toBe(true);
  });

  it("treats a goal of zero or less as already complete", () => {
    expect(coopMissionIsComplete(mission(0, 0))).toBe(true);
    expect(coopMissionIsComplete(mission(-5, 0))).toBe(true);
  });
});

describe("coopMissionRemaining", () => {
  it("returns the distance to the goal", () => {
    expect(coopMissionRemaining(mission(100, 30))).toBe(70);
  });

  it("returns 0 when complete or overshot", () => {
    expect(coopMissionRemaining(mission(100, 100))).toBe(0);
    expect(coopMissionRemaining(mission(100, 120))).toBe(0);
  });

  it("returns 0 for a non-positive goal", () => {
    expect(coopMissionRemaining(mission(0, 0))).toBe(0);
  });
});

describe("missionPercent", () => {
  it("computes a rounded integer percent", () => {
    expect(missionPercent(mission(100, 50))).toBe(50);
    expect(missionPercent(mission(3, 1))).toBe(33);
    expect(missionPercent(mission(3, 2))).toBe(67);
  });

  it("saturates at 100 when complete or overshot", () => {
    expect(missionPercent(mission(100, 100))).toBe(100);
    expect(missionPercent(mission(100, 250))).toBe(100);
  });

  it("clamps negative progress to 0", () => {
    expect(missionPercent(mission(100, -20))).toBe(0);
  });

  it("returns 100 for a non-positive goal", () => {
    expect(missionPercent(mission(0, 0))).toBe(100);
    expect(missionPercent(mission(-10, 5))).toBe(100);
  });
});

describe("addMissionProgress", () => {
  it("adds positive delta without mutating the input", () => {
    const input = mission(100, 10);
    const result = addMissionProgress(input, 15);
    expect(result.mission).toEqual({ goal: 100, progress: 25 });
    expect(result.completed).toBe(false);
    expect(input.progress).toBe(10);
  });

  it("flags completed only on the crossing call", () => {
    const first = addMissionProgress(mission(100, 90), 10);
    expect(first.mission.progress).toBe(100);
    expect(first.completed).toBe(true);
  });

  it("does not re-flag completed for an already complete mission", () => {
    const result = addMissionProgress(mission(100, 100), 20);
    expect(result.mission.progress).toBe(100);
    expect(result.completed).toBe(false);
  });

  it("caps progress at the goal", () => {
    const result = addMissionProgress(mission(50, 40), 999);
    expect(result.mission.progress).toBe(50);
    expect(result.completed).toBe(true);
  });

  it("reverts progress with negative delta and never goes below zero", () => {
    const result = addMissionProgress(mission(100, 30), -50);
    expect(result.mission.progress).toBe(0);
    expect(result.completed).toBe(false);
  });

  it("normalizes an over-goal starting progress before adding", () => {
    const result = addMissionProgress(mission(100, 250), -10);
    expect(result.mission.progress).toBe(90);
    expect(result.completed).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const a = addMissionProgress(mission(100, 20), 33);
    const b = addMissionProgress(mission(100, 20), 33);
    expect(a).toEqual(b);
  });

  it("handles a non-positive goal as already complete", () => {
    const result = addMissionProgress(mission(0, 0), 5);
    expect(result.mission).toEqual({ goal: 0, progress: 0 });
    expect(result.completed).toBe(false);
  });
});

describe("streakBonus", () => {
  it("grows one per consecutive day below the cap", () => {
    expect(streakBonus(1, 7)).toBe(1);
    expect(streakBonus(5, 7)).toBe(5);
  });

  it("saturates at the cap", () => {
    expect(streakBonus(7, 7)).toBe(7);
    expect(streakBonus(30, 7)).toBe(7);
  });

  it("returns 0 for zero or negative days", () => {
    expect(streakBonus(0, 7)).toBe(0);
    expect(streakBonus(-3, 7)).toBe(0);
  });

  it("returns 0 for a non-positive cap", () => {
    expect(streakBonus(5, 0)).toBe(0);
    expect(streakBonus(5, -2)).toBe(0);
  });

  it("truncates fractional days and cap toward zero", () => {
    expect(streakBonus(3.9, 7)).toBe(3);
    expect(streakBonus(10, 4.9)).toBe(4);
  });

  it("returns 0 for NaN inputs", () => {
    expect(streakBonus(Number.NaN, 7)).toBe(0);
    expect(streakBonus(5, Number.NaN)).toBe(0);
  });
});
