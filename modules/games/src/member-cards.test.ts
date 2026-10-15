import { describe, expect, it } from "vitest";
import { buildMemberCard } from "./member-cards.js";

describe("buildMemberCard", () => {
  it("scores power as achievements*10 + helps*5", () => {
    expect(buildMemberCard({ userId: 1, achievements: 3, helps: 4 })).toEqual({
      userId: 1,
      rank: "plata",
      power: 50,
    });
  });

  it("gives a zero-stat member the bronce rank", () => {
    expect(buildMemberCard({ userId: 7, achievements: 0, helps: 0 })).toEqual({
      userId: 7,
      rank: "bronce",
      power: 0,
    });
  });

  it("promotes to plata exactly at the 50 power boundary", () => {
    expect(buildMemberCard({ userId: 2, achievements: 5, helps: 0 })).toEqual({
      userId: 2,
      rank: "plata",
      power: 50,
    });
  });

  it("stays bronce just below the plata boundary", () => {
    expect(buildMemberCard({ userId: 3, achievements: 4, helps: 1 })).toEqual({
      userId: 3,
      rank: "bronce",
      power: 45,
    });
  });

  it("promotes to oro exactly at the 150 power boundary", () => {
    expect(buildMemberCard({ userId: 4, achievements: 15, helps: 0 })).toEqual({
      userId: 4,
      rank: "oro",
      power: 150,
    });
  });

  it("promotes to diamante exactly at the 300 power boundary", () => {
    expect(buildMemberCard({ userId: 5, achievements: 30, helps: 0 })).toEqual({
      userId: 5,
      rank: "diamante",
      power: 300,
    });
  });

  it("keeps diamante for power well above the top threshold", () => {
    expect(
      buildMemberCard({ userId: 6, achievements: 100, helps: 100 }),
    ).toEqual({
      userId: 6,
      rank: "diamante",
      power: 1500,
    });
  });

  it("clamps negative stats to zero before scoring", () => {
    expect(buildMemberCard({ userId: 8, achievements: -5, helps: -3 })).toEqual(
      {
        userId: 8,
        rank: "bronce",
        power: 0,
      },
    );
  });

  it("floors fractional stats before scoring", () => {
    expect(
      buildMemberCard({ userId: 9, achievements: 5.9, helps: 2.9 }),
    ).toEqual({
      userId: 9,
      rank: "plata",
      power: 60,
    });
  });

  it("treats non-finite stats as zero", () => {
    expect(
      buildMemberCard({
        userId: 10,
        achievements: Number.NaN,
        helps: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      userId: 10,
      rank: "bronce",
      power: 0,
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { userId: 11, achievements: 20, helps: 6 } as const;
    const first = buildMemberCard(input);
    const second = buildMemberCard(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ userId: 11, rank: "oro", power: 230 });
  });
});
