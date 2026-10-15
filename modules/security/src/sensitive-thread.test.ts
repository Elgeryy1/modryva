import { describe, expect, it } from "vitest";
import {
  classifyThreadSensitivity,
  describeThreadSensitivity,
} from "./sensitive-thread.js";

describe("classifyThreadSensitivity", () => {
  it("weights reports twice as heavily as conflicts", () => {
    expect(classifyThreadSensitivity({ reports: 1, conflicts: 1 })).toEqual({
      sensitive: false,
      score: 3,
    });
  });

  it("marks sensitive exactly at the default threshold", () => {
    expect(classifyThreadSensitivity({ reports: 2, conflicts: 0 })).toEqual({
      sensitive: true,
      score: 4,
    });
  });

  it("marks sensitive above the default threshold", () => {
    expect(classifyThreadSensitivity({ reports: 1, conflicts: 3 })).toEqual({
      sensitive: true,
      score: 5,
    });
  });

  it("returns not sensitive for a quiet thread", () => {
    expect(classifyThreadSensitivity({ reports: 0, conflicts: 0 })).toEqual({
      sensitive: false,
      score: 0,
    });
  });

  it("honors a custom lower threshold", () => {
    expect(
      classifyThreadSensitivity({ reports: 1, conflicts: 0 }, { threshold: 2 }),
    ).toEqual({ sensitive: true, score: 2 });
  });

  it("honors a custom higher threshold", () => {
    expect(
      classifyThreadSensitivity(
        { reports: 2, conflicts: 0 },
        { threshold: 10 },
      ),
    ).toEqual({ sensitive: false, score: 4 });
  });

  it("sanitizes negative counts to zero", () => {
    expect(classifyThreadSensitivity({ reports: -5, conflicts: -2 })).toEqual({
      sensitive: false,
      score: 0,
    });
  });

  it("floors fractional counts", () => {
    expect(classifyThreadSensitivity({ reports: 1.9, conflicts: 0.9 })).toEqual(
      {
        sensitive: false,
        score: 2,
      },
    );
  });

  it("falls back to the default when threshold is non-finite", () => {
    expect(
      classifyThreadSensitivity(
        { reports: 2, conflicts: 0 },
        { threshold: Number.NaN },
      ),
    ).toEqual({ sensitive: true, score: 4 });
  });

  it("is deterministic across repeated calls", () => {
    const input = { reports: 3, conflicts: 1 } as const;
    const first = classifyThreadSensitivity(input);
    const second = classifyThreadSensitivity(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ sensitive: true, score: 7 });
  });
});

describe("describeThreadSensitivity", () => {
  it("describes a sensitive verdict with accents", () => {
    expect(describeThreadSensitivity({ sensitive: true, score: 6 })).toBe(
      "🔍 Hilo bajo observación: puntuación de sensibilidad 6.",
    );
  });

  it("describes a safe verdict with accents", () => {
    expect(describeThreadSensitivity({ sensitive: false, score: 1 })).toBe(
      "✅ Hilo sin señales de riesgo: puntuación 1.",
    );
  });
});
