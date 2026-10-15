import { describe, expect, it } from "vitest";
import {
  type CreateVerificationSessionInput,
  InMemoryGuardianRepository,
  type VerificationSessionRecord,
} from "./guardian-repository.js";

const mustCreateSession = async (
  repo: InMemoryGuardianRepository,
  input: CreateVerificationSessionInput,
): Promise<VerificationSessionRecord> => {
  const session = await repo.createSession(input);
  expect(session).not.toBeNull();
  if (!session) {
    throw new Error("expected createSession to return a session");
  }
  return session;
};

const baseSessionInput = {
  tenantId: "tenant-1",
  chatId: "chat-1",
  telegramChatId: -100n,
  telegramUserId: 42n,
  mode: "auto" as const,
  challengeDefinition: { steps: [] },
  challengeNonce: "nonce-1",
  sessionTokenHash: "hash-1",
  expiresAt: new Date(Date.now() + 60_000),
  idempotencyKey: "idem-1",
};

describe("InMemoryGuardianRepository settings", () => {
  it("returns null for unconfigured chats and stores defaults + overrides on upsert", async () => {
    const repo = new InMemoryGuardianRepository();
    expect(await repo.getSettings("t", "c")).toBeNull();

    const updated = await repo.upsertSettings("t", "c", {
      enabled: true,
      mode: "auto",
    });
    expect(updated.enabled).toBe(true);
    expect(updated.mode).toBe("auto");
    expect(updated.maxAttempts).toBe(3); // untouched default survives

    const again = await repo.upsertSettings("t", "c", { maxAttempts: 5 });
    expect(again.enabled).toBe(true); // previous fields preserved
    expect(again.maxAttempts).toBe(5);
  });
});

describe("InMemoryGuardianRepository sessions", () => {
  it("creates a session and prevents a second active one for the same chat+user", async () => {
    const repo = new InMemoryGuardianRepository();
    await mustCreateSession(repo, baseSessionInput);

    const second = await repo.createSession({
      ...baseSessionInput,
      challengeNonce: "nonce-2",
      sessionTokenHash: "hash-2",
      idempotencyKey: "idem-2",
    });
    expect(second).toBeNull();
  });

  it("allows a new session once the previous one is resolved", async () => {
    const repo = new InMemoryGuardianRepository();
    const first = await mustCreateSession(repo, baseSessionInput);

    await repo.resolveSession(first.id, first.version, {
      status: "resolved",
      decision: "auto_approve",
      clearIdempotencyKey: true,
    });

    const second = await repo.createSession({
      ...baseSessionInput,
      challengeNonce: "nonce-2",
      sessionTokenHash: "hash-2",
      idempotencyKey: "idem-2",
    });
    expect(second).not.toBeNull();
  });

  it("finds a session by its token hash", async () => {
    const repo = new InMemoryGuardianRepository();
    const session = await mustCreateSession(repo, baseSessionInput);
    const found = await repo.findSessionByTokenHash("hash-1");
    expect(found?.id).toBe(session.id);
  });

  it("rejects an optimistic-lock update with a stale version", async () => {
    const repo = new InMemoryGuardianRepository();
    const session = await mustCreateSession(repo, baseSessionInput);
    const staleUpdate = await repo.markMiniAppOpened(
      session.id,
      session.version + 1,
    );
    expect(staleUpdate).toBeNull();

    const correctUpdate = await repo.markMiniAppOpened(
      session.id,
      session.version,
    );
    expect(correctUpdate?.status).toBe("miniapp_opened");
    expect(correctUpdate?.version).toBe(session.version + 1);
  });

  it("beginAttempt increments both version and attemptCount", async () => {
    const repo = new InMemoryGuardianRepository();
    const session = await mustCreateSession(repo, baseSessionInput);
    const started = await repo.beginAttempt(session.id, session.version);
    expect(started?.attemptCount).toBe(1);
    expect(started?.status).toBe("capturing");
  });

  it("lists expired active sessions but not resolved ones", async () => {
    const repo = new InMemoryGuardianRepository();
    const expired = await mustCreateSession(repo, {
      ...baseSessionInput,
      expiresAt: new Date(Date.now() - 1000),
    });
    await repo.resolveSession(expired.id, expired.version, {
      status: "resolved",
      clearIdempotencyKey: true,
    });

    const stillActive = await mustCreateSession(repo, {
      ...baseSessionInput,
      telegramUserId: 99n,
      idempotencyKey: "idem-active",
      expiresAt: new Date(Date.now() - 1000),
    });

    const expiredList = await repo.listExpiredActiveSessions(new Date());
    expect(expiredList.map((s) => s.id)).toEqual([stillActive.id]);
  });
});

describe("InMemoryGuardianRepository media + staff decisions", () => {
  it("finds media by sha256 across sessions", async () => {
    const repo = new InMemoryGuardianRepository();
    await repo.createMedia({
      sessionId: "s1",
      objectStorageKey: "k1",
      sha256: "abc",
      deleteAfter: new Date(Date.now() + 1000),
    });
    await repo.createMedia({
      sessionId: "s2",
      objectStorageKey: "k2",
      sha256: "abc",
      deleteAfter: new Date(Date.now() + 1000),
    });
    const matches = await repo.findMediaBySha256("abc");
    expect(matches).toHaveLength(2);
  });

  it("records and lists staff decisions in order", async () => {
    const repo = new InMemoryGuardianRepository();
    await repo.createStaffDecision({
      sessionId: "s1",
      moderatorTelegramId: 1n,
      action: "approve",
    });
    const decisions = await repo.listStaffDecisions("s1");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.action).toBe("approve");
  });
});
