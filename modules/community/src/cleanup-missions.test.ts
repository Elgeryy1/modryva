import { describe, expect, it } from "vitest";
import {
  applyBossDamage,
  CLEANUP_ACTION_POINTS,
  CLEANUP_BOSS_DEFAULT_DAMAGE,
  CLEANUP_BOSS_MAX_HP,
  CLEANUP_STREAK_BONUS,
  CLEANUP_STREAK_CAP,
  computeCleanupReward,
} from "./cleanup-missions.js";

describe("computeCleanupReward", () => {
  it("gives base points per action with a zero streak", () => {
    expect(computeCleanupReward("report-confirmed", 0)).toEqual({ points: 10 });
    expect(computeCleanupReward("quarantine-approved", 0)).toEqual({
      points: 25,
    });
    expect(computeCleanupReward("blocklist-hit", 0)).toEqual({ points: 15 });
  });

  it("adds the streak bonus up to the cap", () => {
    expect(computeCleanupReward("report-confirmed", 3).points).toBe(
      10 + 3 * CLEANUP_STREAK_BONUS,
    );
    expect(
      computeCleanupReward("report-confirmed", CLEANUP_STREAK_CAP).points,
    ).toBe(10 + CLEANUP_STREAK_CAP * CLEANUP_STREAK_BONUS);
  });

  it("caps the bonus so huge streaks do not overflow points", () => {
    const capped = 10 + CLEANUP_STREAK_CAP * CLEANUP_STREAK_BONUS;
    expect(computeCleanupReward("report-confirmed", 100).points).toBe(capped);
    expect(
      computeCleanupReward("report-confirmed", CLEANUP_STREAK_CAP + 1).points,
    ).toBe(capped);
  });

  it("treats negative and non-finite streaks as zero for points", () => {
    expect(computeCleanupReward("blocklist-hit", -5)).toEqual({ points: 15 });
    expect(computeCleanupReward("blocklist-hit", Number.NaN)).toEqual({
      points: 15,
    });
    expect(
      computeCleanupReward("blocklist-hit", Number.POSITIVE_INFINITY),
    ).toEqual({
      points: 15,
    });
  });

  it("floors fractional streaks before applying the bonus", () => {
    expect(computeCleanupReward("report-confirmed", 3.9).points).toBe(
      10 + 3 * CLEANUP_STREAK_BONUS,
    );
  });

  it("omits badgeUnlocked below the first threshold", () => {
    expect(
      computeCleanupReward("report-confirmed", 2).badgeUnlocked,
    ).toBeUndefined();
    expect(
      Object.hasOwn(
        computeCleanupReward("report-confirmed", 2),
        "badgeUnlocked",
      ),
    ).toBe(false);
  });

  it("unlocks the bronze badge from a 3-day streak", () => {
    expect(computeCleanupReward("report-confirmed", 3).badgeUnlocked).toBe(
      "escoba-de-bronce",
    );
  });

  it("unlocks the weekly badge from a 7-day streak", () => {
    expect(computeCleanupReward("quarantine-approved", 7).badgeUnlocked).toBe(
      "centinela-semanal",
    );
  });

  it("unlocks the legend badge from a 30-day streak", () => {
    expect(computeCleanupReward("blocklist-hit", 45).badgeUnlocked).toBe(
      "leyenda-antispam",
    );
  });

  it("is deterministic for identical inputs", () => {
    expect(computeCleanupReward("quarantine-approved", 5)).toEqual(
      computeCleanupReward("quarantine-approved", 5),
    );
  });

  it("exposes the action points table used by the calculation", () => {
    expect(CLEANUP_ACTION_POINTS["quarantine-approved"]).toBe(25);
  });
});

describe("applyBossDamage", () => {
  it("subtracts the default damage per confirmed report", () => {
    expect(applyBossDamage(CLEANUP_BOSS_MAX_HP, 10)).toEqual({
      hp: CLEANUP_BOSS_MAX_HP - 10 * CLEANUP_BOSS_DEFAULT_DAMAGE,
      defeated: false,
    });
  });

  it("honors a custom perReport value", () => {
    expect(applyBossDamage(100, 4, 20)).toEqual({ hp: 20, defeated: false });
  });

  it("clamps hp to zero and marks defeated when overkilled", () => {
    expect(applyBossDamage(30, 100, 5)).toEqual({ hp: 0, defeated: true });
  });

  it("marks defeated on an exact kill", () => {
    expect(applyBossDamage(50, 10, 5)).toEqual({ hp: 0, defeated: true });
  });

  it("treats a boss already at zero as defeated", () => {
    expect(applyBossDamage(0, 0)).toEqual({ hp: 0, defeated: true });
  });

  it("does no damage for zero, negative or non-finite reports", () => {
    expect(applyBossDamage(100, 0)).toEqual({ hp: 100, defeated: false });
    expect(applyBossDamage(100, -8)).toEqual({ hp: 100, defeated: false });
    expect(applyBossDamage(100, Number.NaN)).toEqual({
      hp: 100,
      defeated: false,
    });
  });

  it("ignores negative or non-finite perReport (no damage)", () => {
    expect(applyBossDamage(100, 5, -3)).toEqual({ hp: 100, defeated: false });
    expect(applyBossDamage(100, 5, Number.POSITIVE_INFINITY)).toEqual({
      hp: 100,
      defeated: false,
    });
  });

  it("floors fractional reports and perReport before multiplying", () => {
    expect(applyBossDamage(100, 3.9, 5.9)).toEqual({ hp: 85, defeated: false });
  });

  it("treats negative starting hp as an already-defeated boss", () => {
    expect(applyBossDamage(-40, 2, 5)).toEqual({ hp: 0, defeated: true });
  });

  it("is deterministic for identical inputs", () => {
    expect(applyBossDamage(200, 7, 9)).toEqual(applyBossDamage(200, 7, 9));
  });
});
