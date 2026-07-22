import type { GuardianRepository } from "@superbot/data";
import type { ObjectStorageDriver } from "@superbot/module-files";
import { decryptJoinRequestQueryId } from "@superbot/module-guardian";

export interface ExpirationSummary {
  readonly processed: number;
  readonly reverted: number;
  readonly errors: number;
}

export interface GuardianJoinRequestGateway {
  answerChatJoinRequestQuery(input: {
    chatJoinRequestQueryId: string;
    result: "approve" | "decline" | "queue";
    token: string | undefined;
  }): Promise<{ ok: boolean }>;
}

export interface GuardianSessionExpirationContext {
  readonly guardian: GuardianRepository;
  readonly gateway: GuardianJoinRequestGateway;
  readonly sessionSecret: string | undefined;
  /** Optional decrypt-only fallback (env.GUARDIAN_SESSION_SECRET_PREVIOUS) for a
   * session-secret rotation window — lets an expiring session's stored query_id
   * still be decrypted (to answer `queue`) if it was encrypted before rotation. */
  readonly sessionSecretPrevious?: string | undefined;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly now: Date;
}

/**
 * guardian.session.expire — resolves Guardian Verification sessions whose TTL
 * passed while still active. Never auto-approves on expiry: if the Bot API
 * query_id can still be decrypted and a bot token resolved, it answers
 * `queue` (safe fallback per rule: never approve by default on a technical/
 * time-based failure) so a human can still decide; otherwise the request
 * just stays pending in Telegram's native UI.
 */
export const processGuardianSessionExpirations = async (
  context: GuardianSessionExpirationContext,
): Promise<ExpirationSummary> => {
  const due = await context.guardian.listExpiredActiveSessions(context.now);
  let reverted = 0;
  let errors = 0;

  for (const session of due) {
    try {
      if (session.joinRequestQueryIdEncrypted && context.sessionSecret) {
        const decrypted = decryptJoinRequestQueryId(
          session.joinRequestQueryIdEncrypted,
          context.sessionSecret,
          context.sessionSecretPrevious,
        );
        if (decrypted.ok) {
          const token = await context.resolveBotToken(session.tenantId);
          if (token) {
            await context.gateway.answerChatJoinRequestQuery({
              chatJoinRequestQueryId: decrypted.queryId,
              result: "queue",
              token,
            });
          }
        }
      }
      reverted += 1;
    } catch {
      errors += 1;
    }

    await context.guardian.resolveSession(session.id, session.version, {
      status: "expired",
      decision: "manual_review",
      decisionReason: "session_ttl_expired",
      resolvedAt: context.now,
      clearIdempotencyKey: true,
      clearQueryId: true,
    });
  }

  return { processed: due.length, reverted, errors };
};

export interface GuardianMediaRetentionContext {
  readonly guardian: GuardianRepository;
  readonly storage: ObjectStorageDriver;
  readonly now: Date;
}

/**
 * guardian.media.retention_cleanup — deletes Guardian Verification media
 * (from the configured storage driver, local or S3) once its retention
 * period has passed, and marks the row deleted. Runs unconditionally on the
 * schedule regardless of session status — retention is a privacy guarantee,
 * not tied to how the verification was resolved.
 *
 * Deletes BOTH `objectStorageKey` (the original capture) and
 * `thumbnailStorageKey` when present — no code path populates a thumbnail
 * today (verified: nothing in apps/api's Guardian pipeline generates one),
 * but the schema already reserves the field, so this stays correct the
 * moment a future change starts writing one instead of silently leaking it
 * past retention. `storage.delete` is idempotent, so deleting an
 * always-null-today key costs nothing.
 */
export const processGuardianMediaRetention = async (
  context: GuardianMediaRetentionContext,
): Promise<ExpirationSummary> => {
  const due = await context.guardian.listExpiredMedia(context.now);
  let reverted = 0;
  let errors = 0;

  for (const media of due) {
    try {
      await context.storage.delete(media.objectStorageKey);
      if (media.thumbnailStorageKey) {
        await context.storage.delete(media.thumbnailStorageKey);
      }
      await context.guardian.markMediaDeleted(media.id);
      reverted += 1;
    } catch {
      errors += 1;
    }
  }

  return { processed: due.length, reverted, errors };
};

export interface GuardianStaffMessageDeleteGateway {
  deleteMessage(input: {
    chatId: bigint;
    messageId: number;
    token: string | undefined;
  }): Promise<{ ok: boolean }>;
}

export interface GuardianStaffMessageRetentionContext {
  readonly guardian: GuardianRepository;
  readonly gateway: GuardianStaffMessageDeleteGateway;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly now: Date;
}

/**
 * guardian.staff_message.retention_cleanup — deletes the STAFF report message
 * (now the captured face photo itself, or a text report on the no-media
 * technical-failure paths) from Telegram once it has passed its OWN retention
 * deadline, so the same retention promise covers the report as covers the
 * media. Driven by the session's `staffReportDeleteAfter` stamp — NOT by the
 * expired-media cursor: the media-cleanup job permanently marks media rows
 * `deletedAt` and would otherwise remove them from that cursor before this job
 * ran, orphaning the photo in the STAFF chat forever; and no-media text
 * reports never appeared in the media cursor at all.
 *
 * Best-effort like the other jobs here: a missing/unresolvable bot token
 * still clears `staffReportMessageId` (nothing more can be done, and this
 * must never get permanently stuck retrying) — Telegram's own copy of the
 * message may still exist after `deleteMessage` per Telegram's own data
 * retention policy; this only removes it from the chat, which is the most
 * this project can promise (see the final report's honesty section).
 */
export const processGuardianStaffMessageRetention = async (
  context: GuardianStaffMessageRetentionContext,
): Promise<ExpirationSummary> => {
  const due = await context.guardian.listSessionsWithExpiredStaffReport(
    context.now,
  );
  let processed = 0;
  let reverted = 0;
  let errors = 0;

  for (const session of due) {
    if (!session.staffReportMessageId || !session.staffChatId) {
      continue;
    }
    processed += 1;
    try {
      const token = await context.resolveBotToken(session.tenantId);
      if (token) {
        await context.gateway.deleteMessage({
          chatId: session.staffChatId,
          messageId: session.staffReportMessageId,
          token,
        });
      }
    } catch {
      // A failed token resolution or Telegram delete must NOT keep this session
      // stuck being re-listed and retried forever — this job is best-effort (see
      // docstring), exactly like the no-token path. Record the error, then clear
      // the id below regardless. Previously clearStaffReportMessageId sat inside
      // this try, so any deleteMessage failure skipped it and the session became
      // a poison job (re-listed every cycle, retried indefinitely). Telegram's
      // own copy may persist per its retention policy; removing it from the chat
      // is the most this project can promise.
      errors += 1;
    }
    // Always clear, so the session leaves listSessionsWithExpiredStaffReport on
    // the next cycle whether or not Telegram accepted the delete. A failure of
    // this own-DB write (unlike the external Telegram call) legitimately retries.
    await context.guardian.clearStaffReportMessageId(session.id);
    reverted += 1;
  }

  return { processed, reverted, errors };
};
