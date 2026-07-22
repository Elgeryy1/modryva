import { describe, expect, it } from "vitest";
import {
  ALTA_THRESHOLD,
  computeStaffConfidence,
  MEDIA_THRESHOLD,
  rankStaffConfidence,
} from "./staff-confidence.js";

describe("computeStaffConfidence", () => {
  it("scores all-confirmed actions at 100 with band alta", () => {
    expect(computeStaffConfidence({ confirmed: 10, reverted: 0 })).toEqual({
      score: 100,
      band: "alta",
      total: 10,
    });
  });

  it("scores an even split at 50 with band media", () => {
    expect(computeStaffConfidence({ confirmed: 5, reverted: 5 })).toEqual({
      score: 50,
      band: "media",
      total: 10,
    });
  });

  it("scores mostly-reverted actions low with band baja", () => {
    expect(computeStaffConfidence({ confirmed: 2, reverted: 8 })).toEqual({
      score: 20,
      band: "baja",
      total: 10,
    });
  });

  it("returns score 0 and band baja when there are no actions", () => {
    expect(computeStaffConfidence({ confirmed: 0, reverted: 0 })).toEqual({
      score: 0,
      band: "baja",
      total: 0,
    });
  });

  it("rounds fractional ratios to the nearest integer", () => {
    expect(computeStaffConfidence({ confirmed: 2, reverted: 1 })).toEqual({
      score: 67,
      band: "media",
      total: 3,
    });
  });

  it("treats negative and non-finite counts as zero", () => {
    expect(
      computeStaffConfidence({ confirmed: -5, reverted: Number.NaN }),
    ).toEqual({ score: 0, band: "baja", total: 0 });
  });

  it("truncates non-integer counts before scoring", () => {
    expect(computeStaffConfidence({ confirmed: 7.9, reverted: 2.1 })).toEqual({
      score: 78,
      band: "media",
      total: 9,
    });
  });

  it("places bands exactly on the threshold boundaries", () => {
    expect(ALTA_THRESHOLD).toBe(80);
    expect(MEDIA_THRESHOLD).toBe(50);
    // score 80 -> alta (inclusive lower bound)
    expect(computeStaffConfidence({ confirmed: 4, reverted: 1 }).band).toBe(
      "alta",
    );
    // score 79 -> media (just below alta)
    expect(computeStaffConfidence({ confirmed: 79, reverted: 21 }).band).toBe(
      "media",
    );
    // score 49 -> baja (just below media)
    expect(computeStaffConfidence({ confirmed: 49, reverted: 51 }).band).toBe(
      "baja",
    );
  });
});

describe("rankStaffConfidence", () => {
  it("returns an empty array for no members", () => {
    expect(rankStaffConfidence([])).toEqual([]);
  });

  it("orders members by score descending", () => {
    const ranked = rankStaffConfidence([
      { id: "beto", confirmed: 5, reverted: 5 },
      { id: "ana", confirmed: 9, reverted: 1 },
      { id: "dani", confirmed: 0, reverted: 0 },
    ]);
    expect(ranked.map((entry) => entry.id)).toEqual(["ana", "beto", "dani"]);
    expect(ranked[0]).toEqual({
      id: "ana",
      score: 90,
      band: "alta",
      total: 10,
    });
  });

  it("breaks score ties by total then id, deterministically regardless of input order", () => {
    const members: readonly StaffMemberInput[] = [
      { id: "caro", confirmed: 9, reverted: 1 },
      { id: "ana", confirmed: 9, reverted: 1 },
      { id: "leo", confirmed: 4, reverted: 1 },
    ];
    const forward = rankStaffConfidence(members).map((entry) => entry.id);
    const reversed = rankStaffConfidence([...members].reverse()).map(
      (entry) => entry.id,
    );
    expect(forward).toEqual(["ana", "caro", "leo"]);
    expect(reversed).toEqual(["ana", "caro", "leo"]);
  });

  it("ranks higher total above lower total at equal score", () => {
    const ranked = rankStaffConfidence([
      { id: "few", confirmed: 4, reverted: 1 },
      { id: "many", confirmed: 8, reverted: 2 },
    ]);
    expect(ranked.map((entry) => entry.id)).toEqual(["many", "few"]);
    expect(ranked.map((entry) => entry.score)).toEqual([80, 80]);
  });

  it("does not mutate the input array", () => {
    const members = [
      { id: "ana", confirmed: 1, reverted: 9 },
      { id: "beto", confirmed: 9, reverted: 1 },
    ];
    rankStaffConfidence(members);
    expect(members.map((member) => member.id)).toEqual(["ana", "beto"]);
  });
});

interface StaffMemberInput {
  readonly id: string;
  readonly confirmed: number;
  readonly reverted: number;
}
