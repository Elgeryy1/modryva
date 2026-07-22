import { describe, expect, it } from "vitest";
import {
  CONFLICT_RISK_THRESHOLDS,
  computeConflictRisk,
  conflictBurstScore,
  conflictConcentrationScore,
  conflictDeletionScore,
  conflictEditPressure,
  type ThreadStats,
} from "./conflict-risk.js";

const stats = (overrides: Partial<ThreadStats> = {}): ThreadStats => ({
  messages: 10,
  participants: 5,
  deletions: 0,
  recentEditsBy: 0,
  avgGapMs: 30_000,
  ...overrides,
});

describe("conflictBurstScore", () => {
  it("returns max burst for very fast gaps", () => {
    expect(conflictBurstScore(0)).toBe(1);
    expect(conflictBurstScore(3_000)).toBe(1);
    expect(conflictBurstScore(1_000)).toBe(1);
  });

  it("returns no burst for slow gaps", () => {
    expect(conflictBurstScore(60_000)).toBe(0);
    expect(conflictBurstScore(120_000)).toBe(0);
  });

  it("interpolates linearly between fast and slow", () => {
    const mid = conflictBurstScore((3_000 + 60_000) / 2);
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it("treats invalid or negative gaps as no burst", () => {
    expect(conflictBurstScore(-1)).toBe(0);
    expect(conflictBurstScore(Number.NaN)).toBe(0);
    expect(conflictBurstScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("conflictDeletionScore", () => {
  it("returns 0 when there are no messages", () => {
    expect(conflictDeletionScore(5, 0)).toBe(0);
  });

  it("scales the deletion ratio against the heavy threshold", () => {
    // ratio 0.15 over threshold 0.3 => 0.5
    expect(conflictDeletionScore(3, 20)).toBeCloseTo(0.5, 5);
  });

  it("caps at 1 when deletions saturate", () => {
    expect(conflictDeletionScore(10, 10)).toBe(1);
    expect(conflictDeletionScore(6, 10)).toBe(1);
  });

  it("treats negative counts as zero", () => {
    expect(conflictDeletionScore(-4, 10)).toBe(0);
  });
});

describe("conflictConcentrationScore", () => {
  it("returns 0 for a monologue (fewer than 2 participants)", () => {
    expect(conflictConcentrationScore(50, 1)).toBe(0);
    expect(conflictConcentrationScore(50, 0)).toBe(0);
  });

  it("returns 0 when messages-per-participant is low", () => {
    expect(conflictConcentrationScore(4, 2)).toBe(0);
  });

  it("scales toward 1 as few people send many messages", () => {
    // 5 msgs/participant => (5-2)/(8-2) = 0.5
    expect(conflictConcentrationScore(10, 2)).toBeCloseTo(0.5, 5);
  });

  it("caps at 1 for very concentrated threads", () => {
    expect(conflictConcentrationScore(40, 2)).toBe(1);
  });
});

describe("conflictEditPressure", () => {
  it("returns 0 without participants", () => {
    expect(conflictEditPressure(3, 0)).toBe(0);
  });

  it("returns the fraction of editing participants", () => {
    expect(conflictEditPressure(2, 4)).toBeCloseTo(0.5, 5);
  });

  it("caps at 1 when editors exceed participants", () => {
    expect(conflictEditPressure(6, 4)).toBe(1);
  });
});

describe("computeConflictRisk", () => {
  it("returns bajo with score 0 for a near-empty thread", () => {
    expect(computeConflictRisk(stats({ messages: 1 }))).toEqual({
      level: "bajo",
      score: 0,
      reason: "Actividad tranquila, sin senales de conflicto.",
    });
    expect(computeConflictRisk(stats({ messages: 0 }))).toEqual({
      level: "bajo",
      score: 0,
      reason: "Actividad tranquila, sin senales de conflicto.",
    });
  });

  it("returns bajo for a calm, spread-out conversation", () => {
    const result = computeConflictRisk(
      stats({
        messages: 12,
        participants: 10,
        deletions: 0,
        recentEditsBy: 0,
        avgGapMs: 90_000,
      }),
    );
    expect(result.level).toBe("bajo");
    expect(result.score).toBeLessThan(CONFLICT_RISK_THRESHOLDS.medio);
    expect(result.reason).toBe(
      "Actividad tranquila, sin senales de conflicto.",
    );
  });

  it("flags alto for a fast burst with many deletions among few people", () => {
    const result = computeConflictRisk(
      stats({
        messages: 40,
        participants: 2,
        deletions: 15,
        recentEditsBy: 2,
        avgGapMs: 1_500,
      }),
    );
    expect(result.level).toBe("alto");
    expect(result.score).toBeGreaterThanOrEqual(CONFLICT_RISK_THRESHOLDS.alto);
  });

  it("names the burst as the dominant factor when it drives the score", () => {
    const result = computeConflictRisk(
      stats({
        messages: 20,
        participants: 12,
        deletions: 0,
        recentEditsBy: 0,
        avgGapMs: 1_000,
      }),
    );
    expect(result.reason).toBe("Rafaga rapida de mensajes en poco tiempo.");
  });

  it("names deletions as the dominant factor when they dominate", () => {
    const result = computeConflictRisk(
      stats({
        messages: 20,
        participants: 15,
        deletions: 20,
        recentEditsBy: 0,
        avgGapMs: 90_000,
      }),
    );
    expect(result.reason).toBe("Volumen alto de mensajes borrados.");
  });

  it("names concentration when few people carry a long exchange", () => {
    // Concentration alone tops out below the medio threshold, so pair it with a
    // weaker edit signal: concentration stays the dominant contribution.
    const result = computeConflictRisk(
      stats({
        messages: 40,
        participants: 2,
        deletions: 0,
        recentEditsBy: 2,
        avgGapMs: 90_000,
      }),
    );
    expect(result.level).toBe("medio");
    expect(result.reason).toBe(
      "Pocos participantes concentrando la discusion.",
    );
  });

  it("keeps the score within 0..100", () => {
    const result = computeConflictRisk(
      stats({
        messages: 500,
        participants: 2,
        deletions: 500,
        recentEditsBy: 2,
        avgGapMs: 0,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe("alto");
  });

  it("is deterministic for identical inputs", () => {
    const input = stats({
      messages: 30,
      participants: 3,
      deletions: 6,
      recentEditsBy: 2,
      avgGapMs: 4_000,
    });
    expect(computeConflictRisk(input)).toEqual(computeConflictRisk(input));
  });

  it("sanitizes invalid stats instead of throwing", () => {
    const result = computeConflictRisk({
      messages: Number.NaN,
      participants: -3,
      deletions: -1,
      recentEditsBy: Number.NaN,
      avgGapMs: -100,
    });
    expect(result).toEqual({
      level: "bajo",
      score: 0,
      reason: "Actividad tranquila, sin senales de conflicto.",
    });
  });

  it("orders levels monotonically as pressure increases", () => {
    const calm = computeConflictRisk(
      stats({ participants: 10, deletions: 0, avgGapMs: 120_000 }),
    );
    const heated = computeConflictRisk(
      stats({
        messages: 30,
        participants: 3,
        deletions: 8,
        recentEditsBy: 2,
        avgGapMs: 2_000,
      }),
    );
    expect(heated.score).toBeGreaterThan(calm.score);
  });
});
