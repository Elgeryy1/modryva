import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { InMemoryGuardianRepository } from "@superbot/data";
import { LocalObjectStorageDriver } from "@superbot/module-files";
import { encryptJoinRequestQueryId } from "@superbot/module-guardian";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type GuardianJoinRequestGateway,
  type GuardianStaffMessageDeleteGateway,
  processGuardianMediaRetention,
  processGuardianSessionExpirations,
  processGuardianStaffMessageRetention,
} from "./guardian-processor.js";

const secret = "worker-test-secret";

const createExpiredSession = async (
  guardian: InMemoryGuardianRepository,
  overrides: { queryIdEncrypted?: string; telegramUserId?: bigint } = {},
) => {
  const session = await guardian.createSession({
    tenantId: "tenant_1",
    chatId: "chat_1",
    telegramChatId: -100n,
    telegramUserId: overrides.telegramUserId ?? 1n,
    mode: "auto",
    challengeDefinition: { steps: [] },
    challengeNonce: `nonce-${Math.random()}`,
    sessionTokenHash: `hash-${Math.random()}`,
    expiresAt: new Date(Date.now() - 1000),
    idempotencyKey: `idem-${Math.random()}`,
    ...(overrides.queryIdEncrypted !== undefined
      ? { joinRequestQueryIdEncrypted: overrides.queryIdEncrypted }
      : {}),
  });
  expect(session).not.toBeNull();
  if (!session) {
    throw new Error("expected createSession to return a session");
  }
  return session;
};

class FakeGateway implements GuardianJoinRequestGateway {
  calls: Array<{ chatJoinRequestQueryId: string; result: string }> = [];
  async answerChatJoinRequestQuery(input: {
    chatJoinRequestQueryId: string;
    result: "approve" | "decline" | "queue";
    token: string | undefined;
  }) {
    this.calls.push({
      chatJoinRequestQueryId: input.chatJoinRequestQueryId,
      result: input.result,
    });
    return { ok: true };
  }
}

describe("processGuardianSessionExpirations", () => {
  it("resolves an expired session as manual_review and answers queue when query_id is decryptable", async () => {
    const guardian = new InMemoryGuardianRepository();
    const encrypted = encryptJoinRequestQueryId("jrq-1", secret);
    await createExpiredSession(guardian, { queryIdEncrypted: encrypted });
    const gateway = new FakeGateway();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(gateway.calls).toEqual([
      { chatJoinRequestQueryId: "jrq-1", result: "queue" },
    ]);
  });

  it("never approves on expiry, even when it could technically call approve", async () => {
    const guardian = new InMemoryGuardianRepository();
    const encrypted = encryptJoinRequestQueryId("jrq-2", secret);
    await createExpiredSession(guardian, { queryIdEncrypted: encrypted });
    const gateway = new FakeGateway();

    await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(gateway.calls.every((c) => c.result !== "approve")).toBe(true);
  });

  it("still marks the session resolved when there is no query_id / secret / token", async () => {
    const guardian = new InMemoryGuardianRepository();
    const session = await createExpiredSession(guardian, {});
    const gateway = new FakeGateway();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: undefined,
      resolveBotToken: async () => undefined,
      now: new Date(),
    });

    expect(summary.processed).toBe(1);
    expect(gateway.calls).toHaveLength(0);
    const resolved = await guardian.findSessionById(session.id);
    expect(resolved?.status).toBe("expired");
    expect(resolved?.idempotencyKey).toBeNull();
  });

  it("does not touch sessions that are not yet expired", async () => {
    const guardian = new InMemoryGuardianRepository();
    await guardian.createSession({
      tenantId: "t",
      chatId: "c",
      telegramChatId: -100n,
      telegramUserId: 1n,
      mode: "auto",
      challengeDefinition: {},
      challengeNonce: "n",
      sessionTokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "idem-active",
    });
    const gateway = new FakeGateway();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "t",
      now: new Date(),
    });

    expect(summary.processed).toBe(0);
  });
});

describe("processGuardianMediaRetention", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "guardian-retention-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("deletes expired media bytes and marks the row deleted", async () => {
    const guardian = new InMemoryGuardianRepository();
    const storage = new LocalObjectStorageDriver(root);
    await storage.put({
      key: "a.bin",
      data: Buffer.from("x"),
      contentType: "application/octet-stream",
    });
    const media = await guardian.createMedia({
      sessionId: "s1",
      objectStorageKey: "a.bin",
      sha256: "abc",
      deleteAfter: new Date(Date.now() - 1000),
    });

    const summary = await processGuardianMediaRetention({
      guardian,
      storage,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(await storage.exists("a.bin")).toBe(false);
    const updated = await guardian.findMediaById(media.id);
    expect(updated?.deletedAt).not.toBeNull();
  });

  it("leaves media before its retention deadline untouched", async () => {
    const guardian = new InMemoryGuardianRepository();
    const storage = new LocalObjectStorageDriver(root);
    await guardian.createMedia({
      sessionId: "s1",
      objectStorageKey: "b.bin",
      sha256: "def",
      deleteAfter: new Date(Date.now() + 60_000),
    });

    const summary = await processGuardianMediaRetention({
      guardian,
      storage,
      now: new Date(),
    });
    expect(summary.processed).toBe(0);
  });

  it("counts a storage failure as an error without throwing", async () => {
    const guardian = new InMemoryGuardianRepository();
    const storage = new LocalObjectStorageDriver(
      path.join(root, "nonexistent-nested"),
    );
    // Force a delete failure by pointing at a path component that is a file, not a dir.
    await guardian.createMedia({
      sessionId: "s1",
      objectStorageKey: "missing.bin",
      sha256: "ghi",
      deleteAfter: new Date(Date.now() - 1000),
    });

    const summary = await processGuardianMediaRetention({
      guardian,
      storage,
      now: new Date(),
    });
    // LocalObjectStorageDriver.delete() is idempotent (force:true), so a
    // missing file is NOT an error — assert the honest, non-throwing behavior.
    expect(summary.errors).toBe(0);
    expect(summary.reverted).toBe(1);
  });

  it("also deletes the thumbnail when one is present, not just the original", async () => {
    const guardian = new InMemoryGuardianRepository();
    const storage = new LocalObjectStorageDriver(root);
    await storage.put({
      key: "original.bin",
      data: Buffer.from("x"),
      contentType: "application/octet-stream",
    });
    await storage.put({
      key: "thumb.bin",
      data: Buffer.from("y"),
      contentType: "image/jpeg",
    });
    await guardian.createMedia({
      sessionId: "s1",
      objectStorageKey: "original.bin",
      thumbnailStorageKey: "thumb.bin",
      sha256: "jkl",
      deleteAfter: new Date(Date.now() - 1000),
    });

    const summary = await processGuardianMediaRetention({
      guardian,
      storage,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(await storage.exists("original.bin")).toBe(false);
    expect(await storage.exists("thumb.bin")).toBe(false);
  });
});

class FakeDeleteGateway implements GuardianStaffMessageDeleteGateway {
  calls: Array<{ chatId: bigint; messageId: number }> = [];
  async deleteMessage(input: {
    chatId: bigint;
    messageId: number;
    token: string | undefined;
  }): Promise<{ ok: boolean }> {
    this.calls.push({ chatId: input.chatId, messageId: input.messageId });
    return { ok: true };
  }
}

describe("processGuardianStaffMessageRetention", () => {
  const withStaffMessage = async (
    guardian: InMemoryGuardianRepository,
    staffChatId: bigint,
    staffReportMessageId: number,
    opts: { withMedia?: boolean; mediaDeleted?: boolean } = {},
  ) => {
    const session = await createExpiredSession(guardian);
    const resolved = await guardian.resolveSession(
      session.id,
      session.version,
      {
        status: "resolved",
        staffChatId,
        staffReportMessageId,
        // The report stamps its OWN retention deadline; the cleanup job is
        // driven by this, not by the media cursor.
        staffReportDeleteAfter: new Date(Date.now() - 1000),
      },
    );
    expect(resolved).not.toBeNull();
    if (opts.withMedia) {
      const media = await guardian.createMedia({
        sessionId: session.id,
        objectStorageKey: `media-${session.id}.bin`,
        sha256: `sha-${session.id}`,
        deleteAfter: new Date(Date.now() - 1000),
      });
      // Simulate the media-cleanup job having already run and permanently
      // marked the row deleted — the staff-message job must STILL fire.
      if (opts.mediaDeleted) {
        await guardian.markMediaDeleted(media.id);
      }
    }
    return session;
  };

  it("deletes the STAFF report message once its report retention deadline has passed", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    await withStaffMessage(guardian, -1009999n, 777, { withMedia: true });

    const summary = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(gateway.calls).toEqual([{ chatId: -1009999n, messageId: 777 }]);
  });

  it("is idempotent — a second run does nothing once the message id has been cleared", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    await withStaffMessage(guardian, -1009999n, 777);

    await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });
    const second = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(second.processed).toBe(0);
    expect(gateway.calls).toHaveLength(1);
  });

  it("clears the message id even when Telegram delete fails, so it never becomes a poison job", async () => {
    const guardian = new InMemoryGuardianRepository();
    const throwingGateway: GuardianStaffMessageDeleteGateway = {
      deleteMessage: async () => {
        throw new Error("Telegram deleteMessage failed with status 500");
      },
    };
    await withStaffMessage(guardian, -1009999n, 777);

    const first = await processGuardianStaffMessageRetention({
      guardian,
      gateway: throwingGateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });
    // The Telegram delete failed (counted as an error), but the id was still
    // cleared best-effort. Before the fix, reverted was 0 and the session stayed.
    expect(first).toEqual({ processed: 1, reverted: 1, errors: 1 });

    // Proof it is not a poison job: nothing is left to retry next cycle.
    const second = await processGuardianStaffMessageRetention({
      guardian,
      gateway: throwingGateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });
    expect(second.processed).toBe(0);
  });

  it("still clears the message id (best-effort) when no bot token can be resolved", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    await withStaffMessage(guardian, -1009999n, 777);

    const summary = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => undefined,
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(gateway.calls).toEqual([]); // never attempted without a token
  });

  it("skips sessions that never got a STAFF report (no media/text at all)", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    const session = await createExpiredSession(guardian);
    await guardian.createMedia({
      sessionId: session.id,
      objectStorageKey: "no-staff-report.bin",
      sha256: "sha-no-staff",
      deleteAfter: new Date(Date.now() - 1000),
    });

    const summary = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 0, reverted: 0, errors: 0 });
  });

  it("still deletes the STAFF photo after its media row was already marked deleted (not coupled to the media cursor)", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    await withStaffMessage(guardian, -1009999n, 555, {
      withMedia: true,
      mediaDeleted: true,
    });

    const summary = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    // Regression: the media job marking the row deleted must NOT orphan the
    // STAFF photo message.
    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(gateway.calls).toEqual([{ chatId: -1009999n, messageId: 555 }]);
  });

  it("deletes a no-media (technical-failure) text report too", async () => {
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    await withStaffMessage(guardian, -1008888n, 333); // no media row at all

    const summary = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary).toEqual({ processed: 1, reverted: 1, errors: 0 });
    expect(gateway.calls).toEqual([{ chatId: -1008888n, messageId: 333 }]);
  });
});
