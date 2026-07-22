import { describe, expect, it } from "vitest";
import {
  evaluateSecretAchievements,
  type SecretAchievementStats,
} from "./secret-achievements.js";

const stats = (
  overrides: Partial<SecretAchievementStats>,
): SecretAchievementStats => ({
  helps: 0,
  nightMessages: 0,
  cleanDays: 0,
  ...overrides,
});

describe("evaluateSecretAchievements", () => {
  it("returns no achievements when every stat is zero", () => {
    expect(evaluateSecretAchievements(stats({}))).toEqual([]);
  });

  it("unlocks mentor at exactly 50 helps", () => {
    expect(evaluateSecretAchievements(stats({ helps: 50 }))).toEqual([
      { id: "mentor", title: "🧑‍🏫 Mentor de la comunidad" },
    ]);
  });

  it("does not unlock mentor at 49 helps (boundary)", () => {
    expect(evaluateSecretAchievements(stats({ helps: 49 }))).toEqual([]);
  });

  it("unlocks the night owl at exactly 100 night messages", () => {
    expect(evaluateSecretAchievements(stats({ nightMessages: 100 }))).toEqual([
      { id: "buho-nocturno", title: "🦉 Búho nocturno" },
    ]);
  });

  it("unlocks impeccable record at exactly 30 clean days", () => {
    expect(evaluateSecretAchievements(stats({ cleanDays: 30 }))).toEqual([
      { id: "impecable", title: "✨ Historial impecable" },
    ]);
  });

  it("does not unlock impeccable record at 29 clean days (boundary)", () => {
    expect(evaluateSecretAchievements(stats({ cleanDays: 29 }))).toEqual([]);
  });

  it("returns all unlocked achievements in curated catalog order", () => {
    expect(
      evaluateSecretAchievements(
        stats({ helps: 80, nightMessages: 200, cleanDays: 45 }),
      ),
    ).toEqual([
      { id: "mentor", title: "🧑‍🏫 Mentor de la comunidad" },
      { id: "buho-nocturno", title: "🦉 Búho nocturno" },
      { id: "impecable", title: "✨ Historial impecable" },
    ]);
  });

  it("keeps catalog order regardless of which stats are high", () => {
    expect(
      evaluateSecretAchievements(stats({ nightMessages: 100, cleanDays: 30 })),
    ).toEqual([
      { id: "buho-nocturno", title: "🦉 Búho nocturno" },
      { id: "impecable", title: "✨ Historial impecable" },
    ]);
  });

  it("ignores negative stat values", () => {
    expect(
      evaluateSecretAchievements(
        stats({ helps: -100, nightMessages: -5, cleanDays: -30 }),
      ),
    ).toEqual([]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = stats({ helps: 50, nightMessages: 100, cleanDays: 30 });
    const first = evaluateSecretAchievements(input);
    const second = evaluateSecretAchievements(input);
    expect(first).toEqual(second);
  });

  it("does not mutate the input stats object", () => {
    const input = stats({ helps: 60 });
    evaluateSecretAchievements(input);
    expect(input).toEqual(stats({ helps: 60 }));
  });
});
