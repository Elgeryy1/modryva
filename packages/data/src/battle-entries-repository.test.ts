import { describe, expect, it } from "vitest";
import { InMemoryBattleEntriesRepository } from "./battle-entries-repository.js";

describe("InMemoryBattleEntriesRepository", () => {
  it("submits an entry and lists it with zero votes", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const result = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "Bohemian Rhapsody",
    );
    expect(result.outcome).toBe("submitted");

    const entries = await repo.listRoundEntries(
      "t1",
      "c1",
      "playlist",
      "round-1",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.content).toBe("Bohemian Rhapsody");
    expect(entries[0]?.votes).toBe(0);
    expect(entries[0]?.submittedBy).toBe(111n);
  });

  it("rejects a second submission from the same user in the same round", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    await repo.submitEntry("t1", "c1", "playlist", "round-1", 111n, "Song A");
    const second = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "Song B",
    );
    expect(second.outcome).toBe("duplicate");
    expect(
      await repo.listRoundEntries("t1", "c1", "playlist", "round-1"),
    ).toHaveLength(1);
  });

  it("allows the same user to submit again in a different round", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    await repo.submitEntry("t1", "c1", "playlist", "round-1", 111n, "Song A");
    const second = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-2",
      111n,
      "Song B",
    );
    expect(second.outcome).toBe("submitted");
  });

  it("keeps playlist and creativity entries of the same round id separate", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    await repo.submitEntry("t1", "c1", "playlist", "round-1", 111n, "Song A");
    await repo.submitEntry("t1", "c1", "creativity", "round-1", 111n, "Meme A");
    expect(
      await repo.listRoundEntries("t1", "c1", "playlist", "round-1"),
    ).toHaveLength(1);
    expect(
      await repo.listRoundEntries("t1", "c1", "creativity", "round-1"),
    ).toHaveLength(1);
  });

  it("records a vote and reflects it in the vote count", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const submitted = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "Song A",
    );
    if (submitted.outcome !== "submitted") {
      throw new Error("expected submission to succeed");
    }

    const vote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      submitted.entry.id,
      222n,
    );
    expect(vote.outcome).toBe("voted");

    const entries = await repo.listRoundEntries(
      "t1",
      "c1",
      "playlist",
      "round-1",
    );
    expect(entries[0]?.votes).toBe(1);
  });

  it("rejects voting for one's own entry", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const submitted = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "Song A",
    );
    if (submitted.outcome !== "submitted") {
      throw new Error("expected submission to succeed");
    }

    const vote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      submitted.entry.id,
      111n,
    );
    expect(vote.outcome).toBe("self-vote");
  });

  it("rejects a second vote from the same user in the same round", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const a = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "A",
    );
    const b = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      222n,
      "B",
    );
    if (a.outcome !== "submitted" || b.outcome !== "submitted") {
      throw new Error("expected submissions to succeed");
    }

    const firstVote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      a.entry.id,
      333n,
    );
    expect(firstVote.outcome).toBe("voted");

    // Same voter, different entry, same round -> still only one vote allowed.
    const secondVote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      b.entry.id,
      333n,
    );
    expect(secondVote.outcome).toBe("duplicate");
  });

  it("rejects voting for an entry that belongs to a different (e.g. closed) round", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const a = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      111n,
      "A",
    );
    if (a.outcome !== "submitted") {
      throw new Error("expected submission to succeed");
    }

    const vote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-2",
      a.entry.id,
      222n,
    );
    expect(vote.outcome).toBe("not-found");
  });

  it("rejects voting for an unknown entry id", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const vote = await repo.voteEntry(
      "t1",
      "c1",
      "playlist",
      "round-1",
      "nonexistent",
      222n,
    );
    expect(vote.outcome).toBe("not-found");
  });

  it("produces a votes-desc ranking input consistent with resolvePlaylistBattle", async () => {
    const repo = new InMemoryBattleEntriesRepository();
    const a = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "r1",
      1n,
      "Song A",
    );
    const b = await repo.submitEntry(
      "t1",
      "c1",
      "playlist",
      "r1",
      2n,
      "Song B",
    );
    if (a.outcome !== "submitted" || b.outcome !== "submitted") {
      throw new Error("expected submissions to succeed");
    }
    await repo.voteEntry("t1", "c1", "playlist", "r1", b.entry.id, 3n);
    await repo.voteEntry("t1", "c1", "playlist", "r1", b.entry.id, 4n);
    await repo.voteEntry("t1", "c1", "playlist", "r1", a.entry.id, 5n);

    const entries = await repo.listRoundEntries("t1", "c1", "playlist", "r1");
    const bEntry = entries.find((entry) => entry.id === b.entry.id);
    const aEntry = entries.find((entry) => entry.id === a.entry.id);
    expect(bEntry?.votes).toBe(2);
    expect(aEntry?.votes).toBe(1);
  });
});
