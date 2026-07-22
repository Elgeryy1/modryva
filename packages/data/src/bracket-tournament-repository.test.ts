import { describe, expect, it } from "vitest";
import { InMemoryBracketTournamentRepository } from "./bracket-tournament-repository.js";

describe("InMemoryBracketTournamentRepository", () => {
  it("pairs an even entrant list with no byes", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", [
      "Ana",
      "Beto",
      "Cara",
      "Dani",
    ]);
    expect(tournament.status).toBe("open");
    expect(tournament.currentRound).toBe(1);
    expect(tournament.pendingMatches).toEqual([
      { a: "Ana", b: "Beto" },
      { a: "Cara", b: "Dani" },
    ]);
    expect(tournament.roundWinners).toEqual([]);
  });

  it("gives the last odd entrant an automatic bye into roundWinners", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", [
      "Ana",
      "Beto",
      "Cara",
    ]);
    expect(tournament.pendingMatches).toEqual([{ a: "Ana", b: "Beto" }]);
    expect(tournament.roundWinners).toEqual(["Cara"]);
  });

  it("crowns a single entrant champion immediately", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", ["Solo"]);
    expect(tournament.status).toBe("done");
    expect(tournament.champion).toBe("Solo");
    expect(tournament.pendingMatches).toEqual([]);
  });

  it("returns not-found for an unknown tournament id", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const outcome = await repo.recordWinner("missing", "Ana");
    expect(outcome).toEqual({ kind: "not-found" });
  });

  it("returns unknown-entrant when the name isn't in a pending match", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", [
      "Ana",
      "Beto",
    ]);
    const outcome = await repo.recordWinner(tournament.id, "Nadie");
    expect(outcome.kind).toBe("unknown-entrant");
  });

  it("matches entrant names case-insensitively", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", [
      "Ana",
      "Beto",
    ]);
    const outcome = await repo.recordWinner(tournament.id, "ana");
    expect(outcome.kind).toBe("champion");
  });

  it("advances round by round, carrying byes, until a champion is crowned", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const tournament = await repo.createTournament("t1", "c1", [
      "Ana",
      "Beto",
      "Cara",
      "Dani",
      "Eva",
    ]);
    // Round 1: (Ana,Beto) (Cara,Dani) real, Eva auto-bye.
    expect(tournament.pendingMatches).toEqual([
      { a: "Ana", b: "Beto" },
      { a: "Cara", b: "Dani" },
    ]);
    expect(tournament.roundWinners).toEqual(["Eva"]);

    const afterFirst = await repo.recordWinner(tournament.id, "Ana");
    expect(afterFirst.kind).toBe("recorded");
    if (afterFirst.kind !== "recorded") throw new Error("expected recorded");
    expect(afterFirst.tournament.currentRound).toBe(1);
    expect(afterFirst.tournament.pendingMatches).toEqual([
      { a: "Cara", b: "Dani" },
    ]);

    // Completing round 1: winners so far are [Eva (bye), Ana, Cara] (in that
    // recorded order) -> round 2 pairs (Eva,Ana) for real, Cara gets the bye.
    const afterSecond = await repo.recordWinner(tournament.id, "Cara");
    expect(afterSecond.kind).toBe("recorded");
    if (afterSecond.kind !== "recorded") throw new Error("expected recorded");
    expect(afterSecond.tournament.currentRound).toBe(2);
    expect(afterSecond.tournament.pendingMatches).toEqual([
      { a: "Eva", b: "Ana" },
    ]);
    expect(afterSecond.tournament.roundWinners).toEqual(["Cara"]);

    // Round 2's only real match: Eva vs Ana. Ana wins -> round 3 is Cara vs
    // Ana (no bye left, exactly 2 entrants remain).
    const afterThird = await repo.recordWinner(tournament.id, "Ana");
    expect(afterThird.kind).toBe("recorded");
    if (afterThird.kind !== "recorded") throw new Error("expected recorded");
    expect(afterThird.tournament.currentRound).toBe(3);
    expect(afterThird.tournament.pendingMatches).toEqual([
      { a: "Cara", b: "Ana" },
    ]);
    expect(afterThird.tournament.roundWinners).toEqual([]);

    const final = await repo.recordWinner(tournament.id, "Cara");
    expect(final.kind).toBe("champion");
    if (final.kind !== "champion") throw new Error("expected champion");
    expect(final.champion).toBe("Cara");
    expect(final.tournament.status).toBe("done");

    // Once done, recording again is rejected and it no longer shows as open.
    const again = await repo.recordWinner(tournament.id, "Cara");
    expect(again.kind).toBe("already-done");
    expect(await repo.getOpenTournament("t1", "c1")).toBeNull();
  });

  it("tracks one open tournament per (tenant, chat)", async () => {
    const repo = new InMemoryBracketTournamentRepository();
    const t1 = await repo.createTournament("t1", "c1", ["Ana", "Beto"]);
    await repo.createTournament("t1", "c2", ["Cara", "Dani"]);
    expect((await repo.getOpenTournament("t1", "c1"))?.id).toBe(t1.id);
    expect(await repo.getOpenTournament("t2", "c1")).toBeNull();
  });
});
