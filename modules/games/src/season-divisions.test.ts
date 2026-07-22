import { describe, expect, it } from "vitest";
import {
  divisionForPoints,
  SEASON_DIVISIONS,
  type SeasonLeaderboardEntry,
  splitLeaderboard,
} from "./season-divisions.js";

const entry = (
  overrides: Partial<SeasonLeaderboardEntry> = {},
): SeasonLeaderboardEntry => ({
  userId: "u1",
  points: 0,
  isNew: false,
  ...overrides,
});

describe("SEASON_DIVISIONS", () => {
  it("expone las cuatro divisiones esperadas en orden", () => {
    expect(SEASON_DIVISIONS.map((d) => d.id)).toEqual([
      "bronce",
      "plata",
      "oro",
      "diamante",
    ]);
  });

  it("tiene umbrales estrictamente crecientes empezando en 0", () => {
    const first = SEASON_DIVISIONS[0];
    expect(first?.minPoints).toBe(0);
    for (let i = 1; i < SEASON_DIVISIONS.length; i += 1) {
      const prev = SEASON_DIVISIONS[i - 1];
      const curr = SEASON_DIVISIONS[i];
      const prevMin = prev?.minPoints ?? 0;
      const currMin = curr?.minPoints ?? 0;
      expect(currMin).toBeGreaterThan(prevMin);
    }
  });
});

describe("divisionForPoints", () => {
  it("devuelve bronce en el suelo y por debajo", () => {
    expect(divisionForPoints(0)).toBe("bronce");
    expect(divisionForPoints(999)).toBe("bronce");
  });

  it("trata puntos negativos como bronce", () => {
    expect(divisionForPoints(-1)).toBe("bronce");
    expect(divisionForPoints(-100_000)).toBe("bronce");
  });

  it("respeta los umbrales inclusivos", () => {
    expect(divisionForPoints(1_000)).toBe("plata");
    expect(divisionForPoints(5_000)).toBe("oro");
    expect(divisionForPoints(15_000)).toBe("diamante");
  });

  it("mapea puntos intermedios a la division mas alta alcanzada", () => {
    expect(divisionForPoints(4_999)).toBe("plata");
    expect(divisionForPoints(5_001)).toBe("oro");
    expect(divisionForPoints(14_999)).toBe("oro");
    expect(divisionForPoints(1_000_000)).toBe("diamante");
  });

  it("es determinista para la misma entrada", () => {
    expect(divisionForPoints(7_777)).toBe(divisionForPoints(7_777));
  });
});

describe("splitLeaderboard", () => {
  it("separa veteranos y novatos en rankings independientes", () => {
    const result = splitLeaderboard([
      entry({ userId: "vet1", points: 100, isNew: false }),
      entry({ userId: "rook1", points: 50, isNew: true }),
      entry({ userId: "vet2", points: 200, isNew: false }),
      entry({ userId: "rook2", points: 90, isNew: true }),
    ]);
    expect(result.veterans.map((e) => e.userId)).toEqual(["vet2", "vet1"]);
    expect(result.rookies.map((e) => e.userId)).toEqual(["rook2", "rook1"]);
  });

  it("ordena cada grupo por puntos descendente", () => {
    const result = splitLeaderboard([
      entry({ userId: "a", points: 10 }),
      entry({ userId: "b", points: 30 }),
      entry({ userId: "c", points: 20 }),
    ]);
    expect(result.veterans.map((e) => e.points)).toEqual([30, 20, 10]);
  });

  it("asigna rank 1-based por grupo", () => {
    const result = splitLeaderboard([
      entry({ userId: "vet1", points: 300, isNew: false }),
      entry({ userId: "vet2", points: 100, isNew: false }),
      entry({ userId: "rook1", points: 80, isNew: true }),
    ]);
    expect(result.veterans.map((e) => e.rank)).toEqual([1, 2]);
    expect(result.rookies.map((e) => e.rank)).toEqual([1]);
  });

  it("mantiene orden estable en empates de puntos", () => {
    const result = splitLeaderboard([
      entry({ userId: "first", points: 100 }),
      entry({ userId: "second", points: 100 }),
      entry({ userId: "third", points: 100 }),
    ]);
    expect(result.veterans.map((e) => e.userId)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("calcula la division de cada entrada rankeada", () => {
    const result = splitLeaderboard([
      entry({ userId: "v", points: 6_000, isNew: false }),
      entry({ userId: "r", points: 0, isNew: true }),
    ]);
    expect(result.veterans[0]?.division).toBe("oro");
    expect(result.rookies[0]?.division).toBe("bronce");
  });

  it("devuelve grupos vacios cuando no hay entradas", () => {
    const result = splitLeaderboard([]);
    expect(result.veterans).toEqual([]);
    expect(result.rookies).toEqual([]);
  });

  it("maneja una clasificacion solo de novatos", () => {
    const result = splitLeaderboard([
      entry({ userId: "r1", points: 5, isNew: true }),
      entry({ userId: "r2", points: 15, isNew: true }),
    ]);
    expect(result.veterans).toEqual([]);
    expect(result.rookies.map((e) => e.userId)).toEqual(["r2", "r1"]);
  });

  it("no muta el array de entrada", () => {
    const input: readonly SeasonLeaderboardEntry[] = [
      entry({ userId: "a", points: 10 }),
      entry({ userId: "b", points: 20 }),
    ];
    const snapshot = input.map((e) => e.userId);
    splitLeaderboard(input);
    expect(input.map((e) => e.userId)).toEqual(snapshot);
  });

  it("es determinista para la misma entrada", () => {
    const input = [
      entry({ userId: "a", points: 10, isNew: false }),
      entry({ userId: "b", points: 20, isNew: true }),
    ];
    expect(splitLeaderboard(input)).toEqual(splitLeaderboard(input));
  });
});
