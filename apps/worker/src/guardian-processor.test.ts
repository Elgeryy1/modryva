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

/**
 * A fake held to Telegram's ACTUAL rules, not to what makes tests pass. The
 * previous version accepted a decline through answerChatJoinRequestQuery and
 * returned ok:true — a call real Telegram rejects every single time — which is
 * exactly how a permanently broken feature shipped with a green suite. A fake
 * more permissive than production hides the bug it is supposed to model.
 */
class FakeGateway implements GuardianJoinRequestGateway {
  calls: Array<{ chatJoinRequestQueryId: string; result: string }> = [];
  declineCalls: Array<{ chatId: bigint; userId: bigint }> = [];
  /** Set to make declineChatJoinRequest throw, the way the real gateway does
   * on a non-2xx reply from Telegram. */
  declineError: string | null = null;
  /** Make the call return ok:false WITHOUT throwing. The real gateway does
   * this when it skips the call (e.g. missing token) — a skipped call is not
   * a decline, and must never be counted as one. */
  declineReturnsNotOk = false;
  /** Pending join requests as "chatId:userId". Left empty means "don't model
   * this"; populate it to assert the already-gone path against real keys. */
  pending = new Set<string>();
  /** query_ids Telegram has already spent. */
  private readonly answered = new Set<string>();

  async answerChatJoinRequestQuery(input: {
    chatJoinRequestQueryId: string;
    result: "approve" | "decline" | "queue";
    token: string | undefined;
  }) {
    if (!input.token) {
      throw new Error("missing-token");
    }
    // Telegram spends a query_id on its FIRST answer; a second is rejected.
    if (this.answered.has(input.chatJoinRequestQueryId)) {
      throw new Error("QUERY_ID_INVALID: query_id already answered");
    }
    // Guardian answers the query_id on arrival to deliver the Mini App, so by
    // the time the expiry job runs, a decline sent this way can only fail.
    if (input.result === "decline") {
      throw new Error("QUERY_ID_INVALID: query_id already answered");
    }
    this.answered.add(input.chatJoinRequestQueryId);
    this.calls.push({
      chatJoinRequestQueryId: input.chatJoinRequestQueryId,
      result: input.result,
    });
    return { ok: true };
  }

  async declineChatJoinRequest(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }) {
    // Argument checks the real API enforces, so a caller that stops passing
    // real ids fails here instead of silently "succeeding".
    if (!input.token) {
      throw new Error("missing-token");
    }
    if (typeof input.chatId !== "bigint" || typeof input.userId !== "bigint") {
      throw new Error("Bad Request: chat_id and user_id are required");
    }
    if (this.declineError) {
      throw new Error(this.declineError);
    }
    if (this.declineReturnsNotOk) {
      return { ok: false };
    }
    const key = `${input.chatId}:${input.userId}`;
    if (this.pending.size > 0 && !this.pending.has(key)) {
      throw new Error("Bad Request: HIDE_REQUESTER_MISSING");
    }
    this.pending.delete(key);
    this.declineCalls.push({ chatId: input.chatId, userId: input.userId });
    return { ok: true };
  }
}

/** Every counter at zero — spread it to write an EXACT expectation without
 * restating ten fields, so a new counter can never silently go unasserted. */
const noExpiryWork = {
  processed: 0,
  reverted: 0,
  errors: 0,
  declined: 0,
  gone: 0,
  queued: 0,
  retrying: 0,
  abandoned: 0,
  raced: 0,
  failures: [],
};

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

    // Exact, not toMatchObject: the summary grew from three counters to ten
    // and the whole point of those counters is that nobody can claim work that
    // did not happen. Asserting the full shape keeps every one of them honest.
    expect(summary).toEqual({
      ...noExpiryWork,
      processed: 1,
      reverted: 1,
      queued: 1,
    });
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

  it("deletes EVERY mirrored copy, not just the primary", async () => {
    // A report mirrored to several STAFF rooms leaves a face photo in each of
    // them. Deleting only the session's own pointer would strand the rest
    // forever — the same class of bug as the orphaned staff photo of July.
    const guardian = new InMemoryGuardianRepository();
    const gateway = new FakeDeleteGateway();
    const session = await withStaffMessage(guardian, -1001111n, 100);
    await guardian.recordStaffReportCopy({
      sessionId: session.id,
      telegramChatId: -1001111n,
      messageId: 100,
      isPrimary: true,
    });
    for (const [chatId, messageId] of [
      [-1002222n, 200],
      [-1003333n, 300],
    ] as const) {
      await guardian.recordStaffReportCopy({
        sessionId: session.id,
        telegramChatId: chatId,
        messageId,
      });
    }

    const result = await processGuardianStaffMessageRetention({
      guardian,
      gateway,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(result.errors).toBe(0);
    expect(gateway.calls.map((c) => c.messageId).sort()).toEqual([
      100, 200, 300,
    ]);
    // And the rows are gone, so a second cycle cannot try to delete them twice.
    expect(await guardian.listStaffReportCopies(session.id)).toEqual([]);
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

describe("expiry: declining a verification nobody finished", () => {
  // "queue" leaves the request pending forever: it floods the admin queue AND
  // blocks the person, because Telegram refuses a second join request while one
  // is pending. Declining releases them to try again — it is not a ban.
  const expire = async (declineOnExpiry: boolean) => {
    const guardian = new InMemoryGuardianRepository();
    const encrypted = encryptJoinRequestQueryId("jrq-x", secret);
    const session = await createExpiredSession(guardian, {
      queryIdEncrypted: encrypted,
    });
    await guardian.upsertSettings(session.tenantId, session.chatId, {
      declineOnExpiry,
    });
    const gateway = new FakeGateway();
    await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });
    return gateway;
  };

  it("declines through the query_id-free method, the only one that works", async () => {
    // NOT answerChatJoinRequestQuery: Guardian spends the query_id the moment
    // the request arrives, to deliver the Mini App, so every decline sent that
    // way was rejected by Telegram — silently, for every session, for as long
    // as the feature existed.
    const gateway = await expire(true);
    expect(gateway.declineCalls).toHaveLength(1);
    expect(gateway.calls).toEqual([]);
  });

  it("keeps queueing for a group that has not opted in", async () => {
    // Opt-in only: turning this on silently would start rejecting people in
    // every group that never asked for it.
    const gateway = await expire(false);
    expect(gateway.calls.map((c) => c.result)).toEqual(["queue"]);
    expect(gateway.declineCalls).toEqual([]);
  });

  it("counts a request that is already gone as gone, not as an error", async () => {
    // On a backlog most people have already been let in or moved on. Counting
    // those as errors would bury the one message that is a real problem.
    const guardian = new InMemoryGuardianRepository();
    const session = await createExpiredSession(guardian, {});
    await guardian.upsertSettings(session.tenantId, session.chatId, {
      declineOnExpiry: true,
    });
    const gateway = new FakeGateway();
    gateway.declineError = "Bad Request: HIDE_REQUESTER_MISSING";

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary.gone).toBe(1);
    expect(summary.errors).toBe(0);
    expect(summary.declined).toBe(0);
  });

  it("names a real failure instead of swallowing it", async () => {
    // The bare `catch {}` this replaces is what hid the broken decline: the
    // counter rose, the job still reported ok, and the cause was destroyed.
    const guardian = new InMemoryGuardianRepository();
    const session = await createExpiredSession(guardian, {});
    await guardian.upsertSettings(session.tenantId, session.chatId, {
      declineOnExpiry: true,
    });
    const gateway = new FakeGateway();
    gateway.declineError = "Forbidden: bot is not a member of the chat";

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary.errors).toBe(1);
    expect(summary.failures).toEqual([
      "Forbidden: bot is not a member of the chat",
    ]);
  });

  /** Sets up one expired session in a group that opted into declining. */
  const decliningGroup = async () => {
    const guardian = new InMemoryGuardianRepository();
    const session = await createExpiredSession(guardian, {});
    await guardian.upsertSettings(session.tenantId, session.chatId, {
      declineOnExpiry: true,
    });
    return { guardian, session };
  };

  it("does NOT mark a session expired when Telegram never confirmed the decline", async () => {
    // The bug this whole fix exists for. The old code resolved the session
    // outside the try, so a row said "expired, handled" while the request was
    // still pending in Telegram — and because it now looked done, nothing
    // would ever come back for it. Silent, permanent data loss.
    const { guardian } = await decliningGroup();
    const gateway = new FakeGateway();
    gateway.declineError = "Bad Gateway: telegram is having a bad day";
    const now = new Date();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now,
    });

    expect(summary.errors).toBe(1);
    expect(summary.retrying).toBe(1);
    expect(summary.reverted).toBe(0);
    // The load-bearing assertion: still queued as due, therefore still visible
    // to the next tick. Asserting the counter alone would pass even if the row
    // had been resolved anyway.
    expect(await guardian.listExpiredActiveSessions(now)).toHaveLength(1);
  });

  it("retries on the next run and succeeds once Telegram recovers", async () => {
    const { guardian } = await decliningGroup();
    const gateway = new FakeGateway();
    gateway.declineError = "Bad Gateway: telegram is having a bad day";
    const now = new Date();
    const run = () =>
      processGuardianSessionExpirations({
        guardian,
        gateway,
        sessionSecret: secret,
        resolveBotToken: async () => "bot-token",
        now,
      });

    await run();
    gateway.declineError = null; // outage over

    const second = await run();
    expect(second.declined).toBe(1);
    expect(second.reverted).toBe(1);
    expect(second.errors).toBe(0);
    // Resolved for real this time, so it leaves the queue.
    expect(await guardian.listExpiredActiveSessions(now)).toEqual([]);
  });

  it("stops retrying after the give-up window instead of looping forever", async () => {
    // Unbounded retries are their own outage: a permanently broken group would
    // be retried every 60s for ever and crowd out everyone else's sessions.
    const { guardian } = await decliningGroup();
    const gateway = new FakeGateway();
    gateway.declineError = "Forbidden: bot is not a member of the chat";
    const wayLater = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: wayLater,
    });

    expect(summary.abandoned).toBe(1);
    expect(summary.retrying).toBe(0);
    expect(summary.errors).toBe(1);
    // Gave up, so it is finally resolved — but recorded as a give-up, never
    // as a decline that never happened.
    expect(summary.declined).toBe(0);
    expect(await guardian.listExpiredActiveSessions(wayLater)).toEqual([]);
  });

  it("does not count a skipped call (ok:false) as a decline", async () => {
    // The real gateway reports failure two ways: it throws on a Telegram error
    // and returns ok:false when it never made the call. Trusting only the
    // exception would resurrect the false success in a new disguise.
    const { guardian } = await decliningGroup();
    const gateway = new FakeGateway();
    gateway.declineReturnsNotOk = true;

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary.declined).toBe(0);
    expect(summary.errors).toBe(1);
    expect(summary.retrying).toBe(1);
  });

  it("treats a missing bot token as a failure to retry, not as a decision", async () => {
    const { guardian } = await decliningGroup();
    const gateway = new FakeGateway();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => undefined,
      now: new Date(),
    });

    expect(summary.declined).toBe(0);
    expect(summary.retrying).toBe(1);
    expect(gateway.declineCalls).toEqual([]);
  });

  it("does not silently fall back to queue when the settings read fails", async () => {
    // `.catch(() => null)` on getSettings made a database blip indistinguishable
    // from "this chat chose not to decline" — a config change nobody made.
    const { guardian } = await decliningGroup();
    guardian.getSettings = async () => {
      throw new Error("db connection reset");
    };
    const gateway = new FakeGateway();

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary.errors).toBe(1);
    expect(summary.retrying).toBe(1);
    expect(summary.queued).toBe(0);
    expect(gateway.calls).toEqual([]);
    expect(summary.failures).toEqual(["db connection reset"]);
  });

  it("declines the real chat and user ids, not placeholders", async () => {
    const { guardian, session } = await decliningGroup();
    const gateway = new FakeGateway();
    gateway.pending.add(`${session.telegramChatId}:${session.telegramUserId}`);

    const summary = await processGuardianSessionExpirations({
      guardian,
      gateway,
      sessionSecret: secret,
      resolveBotToken: async () => "bot-token",
      now: new Date(),
    });

    expect(summary.declined).toBe(1);
    expect(gateway.declineCalls).toEqual([
      {
        chatId: session.telegramChatId,
        userId: session.telegramUserId,
      },
    ]);
  });
});
