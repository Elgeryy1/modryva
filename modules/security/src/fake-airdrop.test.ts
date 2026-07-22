import { describe, expect, it } from "vitest";
import { detectFakeAirdrop } from "./fake-airdrop.js";

describe("detectFakeAirdrop", () => {
  it("flags several scam terms in AIRDROP_TERMS order", () => {
    expect(
      detectFakeAirdrop("¡AIRDROP! Conecta tu wallet y reclama tokens 🎁"),
    ).toEqual({
      matched: true,
      hits: ["airdrop", "conecta tu wallet", "reclama tokens"],
      score: 3,
    });
  });

  it("keeps AIRDROP_TERMS order regardless of input order", () => {
    expect(detectFakeAirdrop("reclama tokens ahora y luego airdrop")).toEqual({
      matched: true,
      hits: ["airdrop", "reclama tokens"],
      score: 2,
    });
  });

  it("detects claim and free mint together", () => {
    expect(detectFakeAirdrop("Free Mint disponible, haz CLAIM ya")).toEqual({
      matched: true,
      hits: ["claim", "free mint"],
      score: 2,
    });
  });

  it("deduplicates repeated keywords", () => {
    expect(detectFakeAirdrop("airdrop airdrop AIRDROP")).toEqual({
      matched: true,
      hits: ["airdrop"],
      score: 1,
    });
  });

  it("matches a single term", () => {
    expect(detectFakeAirdrop("gran sorteo de tokens este viernes")).toEqual({
      matched: true,
      hits: ["sorteo de tokens"],
      score: 1,
    });
  });

  it("is case-insensitive", () => {
    expect(detectFakeAirdrop("CONECTA TU WALLET")).toEqual({
      matched: true,
      hits: ["conecta tu wallet"],
      score: 1,
    });
  });

  it("returns no match for clean text", () => {
    expect(detectFakeAirdrop("hola equipo, buen dia a todos")).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });

  it("handles undefined", () => {
    expect(detectFakeAirdrop(undefined)).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });

  it("handles empty string", () => {
    expect(detectFakeAirdrop("")).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });

  it("keeps score equal to hits length across all six terms", () => {
    const result = detectFakeAirdrop(
      "airdrop claim conecta tu wallet reclama tokens sorteo de tokens free mint",
    );
    expect(result.hits).toEqual([
      "airdrop",
      "claim",
      "conecta tu wallet",
      "reclama tokens",
      "sorteo de tokens",
      "free mint",
    ]);
    expect(result.score).toBe(result.hits.length);
    expect(result.matched).toBe(true);
  });
});
