import { describe, expect, it } from "vitest";
import { InMemoryGuardianRepository } from "./guardian-repository.js";

const seed = async () => {
  const repo = new InMemoryGuardianRepository();
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100n,
    telegramUserId: 7n,
    mode: "auto",
    challengeDefinition: { steps: [] },
    challengeNonce: "n",
    sessionTokenHash: "h",
    expiresAt: new Date(Date.now() + 60_000),
    idempotencyKey: "idem-progress",
  });
  if (!session) {
    throw new Error("expected a session");
  }
  return { repo, session };
};

describe("advanceProgress", () => {
  it("starts at zero — nobody has opened anything yet", async () => {
    const { session } = await seed();
    expect(session.progressStep).toBe(0);
  });

  it("records how far someone got", async () => {
    const { repo, session } = await seed();
    await repo.advanceProgress(session.id, 4);
    expect((await repo.findSessionById(session.id))?.progressStep).toBe(4);
  });

  it("never walks backwards, so a page reload cannot fake a worse funnel", async () => {
    // The Mini App re-fetches /session on every load, which marks step 1. If
    // that could overwrite step 4, everyone would look like they quit at the
    // first screen.
    const { repo, session } = await seed();
    await repo.advanceProgress(session.id, 4);
    await repo.advanceProgress(session.id, 1);
    expect((await repo.findSessionById(session.id))?.progressStep).toBe(4);
  });

  it("ignores a repeat of the same step", async () => {
    const { repo, session } = await seed();
    await repo.advanceProgress(session.id, 3);
    await repo.advanceProgress(session.id, 3);
    expect((await repo.findSessionById(session.id))?.progressStep).toBe(3);
  });

  it("does nothing for a session that does not exist", async () => {
    const { repo } = await seed();
    await expect(repo.advanceProgress("nope", 2)).resolves.toBeUndefined();
  });
});
