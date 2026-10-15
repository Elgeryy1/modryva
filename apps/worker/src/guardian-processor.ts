import type {
  GuardianRepository,
  IntroductionPendingRecord,
  IntroductionRepository,
  VerificationSessionRecord,
} from "@superbot/data";
import {
  buildIntroductionKickNotice,
  buildIntroductionStaffAutoResolved,
  buildIntroductionStaffCard,
  buildIntroductionStaffKeyboard,
  buildIntroductionWarnNotice,
  INTRODUCTION_WARN_REASON,
  type IntroductionSettings,
  type IntroductionWarnCount,
  mentionHtml,
} from "@superbot/module-community";
import type { ObjectStorageDriver } from "@superbot/module-files";
import { decryptJoinRequestQueryId } from "@superbot/module-guardian";
import { buildRemoveWarnButton, esIntocable } from "@superbot/module-security";

export interface ExpirationSummary {
  readonly processed: number;
  readonly reverted: number;
  readonly errors: number;
}

/** Splits the one number the job used to report into the numbers that say what
 * actually happened in Telegram. `reverted` alone could not distinguish "we
 * declined 34 requests" from "we touched 34 rows and every Telegram call
 * failed" — which is precisely how a permanently broken decline ran for days
 * reporting success. Every field below is a claim the job can substantiate. */
export interface GuardianExpirationSummary extends ExpirationSummary {
  /** Join requests actually declined in Telegram, confirmed by the API. */
  readonly declined: number;
  /** Requests that were already gone (approved, left, or the person cancelled
   * it). A real end state, not a failure — on a backlog it is the majority. */
  readonly gone: number;
  /** Sessions answered with the legacy `queue` fallback (decline not enabled). */
  readonly queued: number;
  /** Sessions deliberately left UNRESOLVED because Telegram never confirmed,
   * so the next tick retries them. These are the ones the old code lied about. */
  readonly retrying: number;
  /** Sessions resolved despite a failed decline because they exhausted
   * DECLINE_RETRY_WINDOW_MS — bounded give-up, never an infinite retry. */
  readonly abandoned: number;
  /** Sessions another worker or a human resolved first (optimistic-lock race).
   * Not an error, but never counted as work this run performed. */
  readonly raced: number;
  /** Distinct failure messages, deduped and capped, so a broken call names
   * itself in the job log instead of vanishing into a bare catch. */
  readonly failures: readonly string[];
}

export interface GuardianJoinRequestGateway {
  answerChatJoinRequestQuery(input: {
    chatJoinRequestQueryId: string;
    result: "approve" | "decline" | "queue";
    token: string | undefined;
  }): Promise<{ ok: boolean }>;
  /** The query_id-free decline. Telegram treats a query_id as spent once it
   * has been answered — and Guardian answers it immediately, to deliver the
   * Mini App — so by expiry time only this method can still reach the
   * pending request. */
  declineChatJoinRequest(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<{ ok: boolean }>;
}

/** Telegram's way of saying "there is no pending request here any more".
 * Distinguishing this from a real failure matters: on a backlog most people
 * have already been let in or moved on, and counting those as errors would
 * bury the one message that is a genuine problem. */
const isRequestAlreadyGone = (message: string): boolean =>
  /HIDE_REQUESTER_MISSING|USER_ALREADY_PARTICIPANT|PARTICIPANT_ID_INVALID|USER_NOT_PARTICIPANT|not found/iu.test(
    message,
  );

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * How long a session whose decline keeps failing for a REAL reason is retried
 * before it is resolved anyway.
 *
 * There has to be a bound. Refusing to resolve is what makes the retry work at
 * all (the session stays active and overdue, so the next tick re-lists it), but
 * without a ceiling a permanently broken group would be retried every 60s
 * forever and would crowd the batch. Two hours is ~120 attempts — enough to
 * ride out a Telegram outage, short enough that nothing is stuck for a day.
 *
 * Deliberately derived from `expiresAt`, which the session already carries, so
 * bounding retries needs no new column and no migration.
 */
const DECLINE_RETRY_WINDOW_MS = 2 * 60 * 60 * 1000;

/** What the job managed to do in Telegram for a single session. `failed` is a
 * first-class outcome, not an exception swallowed on the way out. */
type JoinRequestOutcome =
  | { readonly kind: "declined" }
  | { readonly kind: "gone" }
  | { readonly kind: "queued" }
  | { readonly kind: "noop"; readonly note?: string }
  | { readonly kind: "failed"; readonly message: string };

/**
 * Everything this job does in TELEGRAM for one session. Kept separate from the
 * loop so the database half (resolveSession) can be made conditional on what
 * this returns: the old code called both unconditionally, which is how sessions
 * got stamped `expired` while their join request was never actually answered.
 */
const settleJoinRequest = async (
  context: GuardianSessionExpirationContext,
  session: VerificationSessionRecord,
): Promise<JoinRequestOutcome> => {
  // NOT wrapped in `.catch(() => null)`. A settings read that fails would then
  // look identical to "this chat chose not to decline", turning a database blip
  // into a silent policy change — the same class of lie as the bug being fixed.
  // Letting it throw routes it to the retry path, where it belongs.
  const settings = await context.guardian.getSettings(
    session.tenantId,
    session.chatId,
  );
  const token = await context.resolveBotToken(session.tenantId);

  if (settings?.declineOnExpiry) {
    if (!token) {
      // Retryable on purpose: a token that cannot be resolved right now is an
      // infrastructure problem, not a decision to leave the request pending.
      return {
        kind: "failed",
        message: "cannot decline: no bot token resolved for tenant",
      };
    }
    // Deliberately NOT answerChatJoinRequestQuery. Guardian answers the
    // query_id the moment the request arrives, to deliver the Mini App, and
    // Telegram considers a query_id spent once answered — so every decline
    // attempted through it failed, silently, for every session ever. This
    // method needs no query_id and reaches the pending request directly.
    //
    // Declining is not a punishment: Telegram refuses a SECOND join request
    // while one is outstanding, so leaving it pending traps the person with no
    // way to start over. The decline is what releases them to ask again.
    try {
      const result = await context.gateway.declineChatJoinRequest({
        chatId: session.telegramChatId,
        userId: session.telegramUserId,
        token,
      });
      // The gateway reports failure two different ways — it throws on a
      // Telegram error, and returns ok:false when it skipped the call (e.g.
      // missing token). Treating a skipped call as a decline is exactly the
      // false success this fix exists to remove, so check the flag too.
      return result.ok
        ? { kind: "declined" }
        : {
            kind: "failed",
            message: "declineChatJoinRequest returned ok:false (call skipped)",
          };
    } catch (error) {
      const message = describeError(error);
      return isRequestAlreadyGone(message)
        ? { kind: "gone" }
        : { kind: "failed", message };
    }
  }

  // Decline not enabled for this chat: fall back to `queue` so a human can
  // still decide. Best effort by design — see the catch below.
  if (
    !session.joinRequestQueryIdEncrypted ||
    !context.sessionSecret ||
    !token
  ) {
    return { kind: "noop" };
  }
  const decrypted = decryptJoinRequestQueryId(
    session.joinRequestQueryIdEncrypted,
    context.sessionSecret,
    context.sessionSecretPrevious,
  );
  if (!decrypted.ok) {
    return { kind: "noop", note: "queue fallback: query_id not decryptable" };
  }
  try {
    const result = await context.gateway.answerChatJoinRequestQuery({
      chatJoinRequestQueryId: decrypted.queryId,
      result: "queue",
      token,
    });
    return result.ok
      ? { kind: "queued" }
      : { kind: "noop", note: "queue fallback returned ok:false" };
  } catch (error) {
    // A rejection here is the EXPECTED case, not a fault: this query_id was
    // almost certainly spent delivering the Mini App. So it must not block the
    // session (that would retry a call that can never succeed) — but it is
    // still recorded, because "expected to fail" and "silently discarded" are
    // not the same thing, and the second is what hid the original bug.
    return {
      kind: "noop",
      note: `queue fallback rejected: ${describeError(error)}`,
    };
  }
};

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
 * passed while still active. Never auto-approves on expiry (safe fallback per
 * rule: never approve by default on a technical or time-based failure).
 *
 * Where the chat opted into `declineOnExpiry`, the pending join request is
 * declined via declineChatJoinRequest — the query_id-free method, because the
 * query_id was already spent delivering the Mini App. Otherwise it falls back
 * to answering `queue` so a human can still decide.
 *
 * The session row is only marked `expired` once Telegram has confirmed an
 * outcome. A decline that failed for a real reason leaves the session active
 * and overdue so the next tick retries it, bounded by DECLINE_RETRY_WINDOW_MS.
 * The returned summary distinguishes each of those cases by design: reporting
 * one undifferentiated success count is how the broken decline hid for days.
 */
export const processGuardianSessionExpirations = async (
  context: GuardianSessionExpirationContext,
): Promise<GuardianExpirationSummary> => {
  const due = await context.guardian.listExpiredActiveSessions(context.now);
  let reverted = 0;
  let errors = 0;
  let declined = 0;
  let gone = 0;
  let queued = 0;
  let retrying = 0;
  let abandoned = 0;
  let raced = 0;
  const failures = new Set<string>();

  for (const session of due) {
    let outcome: JoinRequestOutcome;
    try {
      outcome = await settleJoinRequest(context, session);
    } catch (error) {
      // The last-resort net. It is NOT a bare `catch {}` — the message is kept
      // and, crucially, the failure changes what happens next instead of being
      // absorbed on the way to an unconditional "expired".
      outcome = { kind: "failed", message: describeError(error) };
    }

    if (outcome.kind === "failed") {
      errors += 1;
      failures.add(outcome.message);

      // THE FIX. The old code resolved the session here regardless, so a row
      // said "expired, handled" while Telegram had confirmed nothing and the
      // join request stayed pending forever — with the session now marked
      // done, nothing would ever look at it again. Leaving it unresolved keeps
      // it active and overdue, so the next tick re-lists and retries it.
      const overdueMs = context.now.getTime() - session.expiresAt.getTime();
      if (overdueMs < DECLINE_RETRY_WINDOW_MS) {
        retrying += 1;
        continue;
      }
      // Past the window: stop retrying forever. Resolve it, but record WHY, so
      // "we gave up" is never mistaken for "we declined it".
      abandoned += 1;
    }

    if (outcome.kind === "declined") {
      declined += 1;
    } else if (outcome.kind === "gone") {
      gone += 1;
    } else if (outcome.kind === "queued") {
      queued += 1;
    } else if (outcome.kind === "noop" && outcome.note) {
      failures.add(outcome.note);
    }

    const resolved = await context.guardian.resolveSession(
      session.id,
      session.version,
      {
        status: "expired",
        decision: "manual_review",
        decisionReason:
          outcome.kind === "failed"
            ? "session_ttl_expired_decline_failed"
            : "session_ttl_expired",
        resolvedAt: context.now,
        clearIdempotencyKey: true,
        // Only drop the stored query_id once the session is genuinely finished.
        // On the retry path this line is never reached, so the ciphertext
        // survives for the next attempt.
        clearQueryId: true,
      },
    );

    // resolveSession is an optimistic-locked updateMany: null means another
    // worker (or a human decision) moved this session first. Two workers can
    // therefore both reach Telegram, but a repeat decline is harmless — the
    // second one comes back "already gone" — whereas double-counting the work
    // would make the summary lie again.
    if (resolved) {
      reverted += 1;
    } else {
      raced += 1;
    }
  }

  return {
    processed: due.length,
    reverted,
    errors,
    declined,
    gone,
    queued,
    retrying,
    abandoned,
    raced,
    failures: [...failures].slice(0, 5),
  };
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
        // A report can be mirrored to several STAFF rooms, so deleting the
        // session's own pointer would leave every mirror behind — a face photo
        // sitting in those chats forever. Walk the recorded copies instead, and
        // fall back to the single pointer for sessions that predate them.
        const copies = await context.guardian
          .listStaffReportCopies(session.id)
          .catch(() => []);
        const targets =
          copies.length > 0
            ? copies.map((copy) => ({
                chatId: copy.telegramChatId,
                messageId: copy.messageId,
              }))
            : [
                {
                  chatId: session.staffChatId,
                  messageId: session.staffReportMessageId,
                },
              ];
        let copyFailed = false;
        for (const target of targets) {
          // Per copy: one room refusing must not strand the rest. But a
          // swallowed failure must still be COUNTED — silently reporting zero
          // errors while photos stay up is worse than the poison job this
          // best-effort handling replaced.
          await context.gateway
            .deleteMessage({ ...target, token })
            .catch(() => {
              copyFailed = true;
            });
        }
        if (copyFailed) {
          errors += 1;
        }
        await context.guardian
          .deleteStaffReportCopies(session.id)
          .catch(() => undefined);
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

export interface IntroductionSweepContext {
  readonly introductions: IntroductionRepository;
  /**
   * Ids que esta puerta no toca, de `SUPERBOT_INTOCABLES_TELEGRAM_IDS`.
   *
   * Requerido y no opcional, igual que `warns` y por lo mismo: un despliegue
   * que no lo cablee volveria a pedirle la presentacion a quien no debe, en
   * silencio. Vacio es la respuesta valida para "aqui no hay ninguno".
   *
   * No sustituye a la comprobacion de admin de mas abajo — la complementa. Esa
   * cuelga del cargo y se cae en cuanto la persona deja de tenerlo; esta cuelga
   * del id. Y esta va primero porque no cuesta una llamada a Telegram.
   */
  readonly intocables: readonly bigint[];
  readonly gateway: {
    sendMessage(input: {
      chatId: bigint;
      reply: {
        text: string;
        parseMode?: string;
        replyMarkup?: Record<string, unknown>;
      };
      token: string | undefined;
      messageThreadId?: number;
    }): Promise<{ ok: boolean; messageId?: number }>;
    getChatMember(input: {
      chatId: bigint;
      userId: bigint;
      token: string | undefined;
    }): Promise<{ ok: boolean; status?: string }>;
    // La escalada expulsa y cierra su propia ficha. El kick es el mismo par
    // ban-de-120s + unban del botón de staff: quien sale puede volver a
    // entrar, nunca queda vetado.
    banChatMember(input: {
      chatId: bigint;
      userId: bigint;
      token: string | undefined;
      untilDate: Date | undefined;
    }): Promise<unknown>;
    unbanChatMember(input: {
      chatId: bigint;
      userId: bigint;
      token: string | undefined;
      onlyIfBanned?: boolean;
    }): Promise<unknown>;
    editMessageText(input: {
      chatId: bigint;
      messageId: number;
      reply: {
        text: string;
        // La union exacta de BotReply y no `string`: con `string` ninguna de
        // las dos direcciones de la bivarianza cuadra y HttpTelegramGateway
        // deja de ser asignable a este contexto.
        parseMode?: "Markdown" | "MarkdownV2" | "HTML";
        replyMarkup?: Record<string, unknown>;
      };
      token: string | undefined;
    }): Promise<{ ok: boolean }>;
  };
  /** Where this group's STAFF reports go. Null when the group has none. */
  readonly staffRoom: (
    tenantId: string,
    chatId: string,
  ) => Promise<{
    readonly staffChatId: bigint | null;
    readonly staffThreadId: number | null;
    /**
     * Tema donde van las fichas de presentación, cuando el grupo lo separa del
     * de Guardian. Null → el mismo de siempre (`staffThreadId`).
     */
    readonly introductionThreadId?: number | null;
  } | null>;
  /** Only to name the group on the card. Failure is cosmetic, never fatal. */
  readonly chatTitle: (chatId: string) => Promise<string | null>;
  /**
   * Lo que el grupo exige de verdad en una presentacion, para poder repetirselo
   * a la persona en el aviso publico. NO se usan los valores por defecto: un
   * mensaje que pide una foto donde el grupo no la pide acaba avisando a quien
   * hizo exactamente lo que se le dijo.
   */
  readonly introductionSettings: (
    tenantId: string,
    chatId: string,
  ) => Promise<IntroductionSettings>;
  /**
   * El aviso automatico que acompaña a cada ficha.
   *
   * Requerido y no opcional a proposito. Si pudiera faltar, un despliegue que no
   * lo cableara dejaria de poner avisos sin que nada lo dijera — que es
   * exactamente como se acumularon los 167 ficheros muertos de este repo. Que el
   * compilador obligue a conectarlo es la unica garantia barata que hay.
   */
  readonly warns: {
    /** Crea el warn y devuelve su id. */
    create(input: {
      readonly tenantId: string;
      readonly chatId: string;
      readonly subjectTelegramUserId: bigint;
      readonly reason: string;
    }): Promise<{ readonly recordId: string }>;
    /** Warns activos DESPUES de crear el de arriba. */
    countActive(
      tenantId: string,
      chatId: string,
      subjectTelegramUserId: bigint,
    ): Promise<number>;
    /** El limite del grupo, solo para poder enseñar "1/3". */
    limitFor(chatId: string): Promise<number>;
    /** Deshace el warn cuando la ficha nunca llego a publicarse. */
    revert(warningId: string): Promise<void>;
  };
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly audit: (input: {
    tenantId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
  readonly now: Date;
}

/**
 * Every outcome the sweep can produce, counted separately.
 *
 * The old job reported one number for "we did something", and on 3 Aug 2026 it
 * was the only trace of thirteen people being removed — three of them group
 * administrators. Nobody could answer WHO or WHY from the logs, because the job
 * deleted the row and wrote no audit. Each field here is a claim that can be
 * checked against `audit_logs`.
 */
export interface IntroductionSweepSummary extends ExpirationSummary {
  /** STAFF cards actually posted. */
  readonly reported: number;
  /** Administrators the gate does not apply to. */
  readonly skippedAdmin: number;
  /**
   * Intocables, que no pasan por la puerta pase lo que pase.
   *
   * Contador aparte y no sumado a `skippedAdmin` a proposito: son dos reglas
   * distintas, y mezclarlas escondería que la lista de intocables está
   * haciendo algo — que es justo lo que hay que poder mirar si un dia alguien
   * deja de recibir la puerta sin saber por que.
   */
  readonly skippedIntocable: number;
  /** Already out of the group by the time the deadline passed. */
  readonly alreadyGone: number;
  /** Deadline passed but the group has no STAFF room to ask. */
  readonly noStaffChat: number;
  /** Avisos automaticos escritos, uno por ficha publicada. */
  readonly warned: number;
  /**
   * Fichas publicadas SIN aviso porque escribirlo fallo. Contador aparte y no
   * sumado a `errors`: la ficha si salio y una persona va a decidir igual, asi
   * que confundirlo con "no se hizo nada" mandaria a buscar un problema que no
   * es el que hay.
   */
  readonly warnErrors: number;
  /** Avisos periodicos puestos por la escalada (los de despues de la ficha). */
  readonly escalatedWarns: number;
  /** Personas expulsadas por la escalada al llegar al limite de avisos. */
  readonly autoKicked: number;
  readonly failures: readonly string[];
}

const ADMIN_STATUSES = new Set(["creator", "administrator"]);
const GONE_STATUSES = new Set(["left", "kicked"]);

/**
 * El aviso publico en el grupo: por que se le ha avisado y como deshacerlo.
 *
 * Best-effort a proposito, y por eso va DESPUES de la ficha. El warn ya existe y
 * el staff ya lo sabe; que Telegram rechace este mensaje (grupo cerrado al bot,
 * limite de envios, lo que sea) no puede deshacer nada de lo anterior. Se
 * registra el fallo y se sigue.
 *
 * Lleva el boton de quitar el warn, que es el mismo de `/warn` y esta cerrado a
 * administradores por `moderation.unwarn` en el enrutador de callbacks. Que este
 * en el propio mensaje y no en la ficha es deliberado: el falso positivo lo ve
 * antes quien esta en el grupo que quien mira la sala de STAFF.
 */
const avisarEnElGrupo = async (
  context: IntroductionSweepContext,
  row: IntroductionPendingRecord,
  aviso: {
    readonly warn: IntroductionWarnCount;
    /** El id del `Warning`, NO el de la fila de presentacion: es lo que el
     * boton le pasa a `expireWarning`. Confundirlos deja un boton que no quita
     * nada y dice que si. */
    readonly warnId: string;
    readonly settings: IntroductionSettings;
    readonly token: string | undefined;
  },
): Promise<void> => {
  const { warn, warnId, settings, token } = aviso;
  try {
    const quien = mentionHtml(
      row.telegramUserId,
      row.username ? `@${row.username}` : row.telegramUserId.toString(),
    );
    const enviado = await context.gateway.sendMessage({
      chatId: row.telegramChatId,
      reply: {
        text: buildIntroductionWarnNotice({ who: quien, settings, warn }),
        parseMode: "HTML",
        replyMarkup: buildRemoveWarnButton(warnId),
      },
      token,
    });
    await context.audit({
      tenantId: row.tenantId,
      action: enviado.ok
        ? "introduction.warned"
        : "introduction.warn_notice_failed",
      resourceType: "chat_member",
      resourceId: row.telegramUserId.toString(),
      payload: {
        chatId: row.chatId,
        pendingId: row.id,
        count: warn.count,
        limit: warn.limit,
      },
    });
  } catch {
    // El warn esta puesto y la ficha publicada: nada que deshacer aqui.
    await context
      .audit({
        tenantId: row.tenantId,
        action: "introduction.warn_notice_failed",
        resourceType: "chat_member",
        resourceId: row.telegramUserId.toString(),
        payload: { chatId: row.chatId, pendingId: row.id },
      })
      .catch(() => undefined);
  }
};

/**
 * community.introduction_sweep — hands over newcomers who never introduced
 * themselves, so a human decides.
 *
 * It used to expel them itself. It cannot: this runs in the worker, where there
 * is no notion of who anybody is, and on 3 Aug 2026 it removed three admins the
 * bot had appointed hours earlier. A rule that cannot see exceptions must not be
 * the one pulling the trigger — so now it posts a card with two buttons in the
 * group's STAFF room and stops there.
 *
 * The row survives until somebody presses a button (that is what `reportedAt`
 * is for). If the person introduces themselves in the meantime, the normal
 * message handler deletes the row and the card goes stale on its own.
 */
export const processIntroductionSweep = async (
  context: IntroductionSweepContext,
): Promise<IntroductionSweepSummary> => {
  const due = await context.introductions.listOverdue(context.now);
  let reported = 0;
  let skippedAdmin = 0;
  let skippedIntocable = 0;
  let alreadyGone = 0;
  let noStaffChat = 0;
  let warned = 0;
  let warnErrors = 0;
  let errors = 0;
  const failures = new Set<string>();

  const close = async (row: (typeof due)[number]): Promise<void> => {
    await context.introductions
      .clear(row.tenantId, row.chatId, row.telegramUserId)
      .catch(() => undefined);
  };

  for (const row of due) {
    let marked = false;
    let warnToRevert: string | null = null;
    try {
      const token = await context.resolveBotToken(row.tenantId);
      if (!token) {
        errors += 1;
        failures.add("missing-token");
        continue; // Sin token no se puede ni mirar. La fila se queda.
      }

      // Un intocable tampoco pasa por esta puerta, y se mira antes que nada:
      // no cuesta una llamada a Telegram y, al contrario que la comprobacion
      // de admin de justo debajo, no depende de que la persona tenga cargo.
      if (esIntocable(row.telegramUserId, context.intocables)) {
        skippedIntocable += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.skipped_untouchable",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId },
        });
        await close(row);
        continue;
      }

      // Quien es admin del grupo no pasa por esta puerta. Se mira ANTES de
      // molestar al staff: una ficha diciendo "el admin X no se presento" es
      // ruido que nadie va a pulsar.
      const member = await context.gateway.getChatMember({
        chatId: row.telegramChatId,
        userId: row.telegramUserId,
        token,
      });
      if (member.ok && member.status && ADMIN_STATUSES.has(member.status)) {
        skippedAdmin += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.skipped_admin",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId, status: member.status },
        });
        await close(row);
        continue;
      }
      if (member.ok && member.status && GONE_STATUSES.has(member.status)) {
        alreadyGone += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.already_gone",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId, status: member.status },
        });
        await close(row);
        continue;
      }
      // Si la consulta falla no se asume nada: sigue adelante y que lo mire una
      // persona. Un fallo de red no puede ser lo que decide por nosotros.

      const room = await context.staffRoom(row.tenantId, row.chatId);
      if (!room?.staffChatId) {
        noStaffChat += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.no_staff_chat",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId },
        });
        // Se marca reportada, no se borra: sin sala de staff no hay a quien
        // preguntar, y republicar cada minuto no arregla eso. La fila queda
        // como constancia de que el plazo vencio.
        await context.introductions.markReported(row.id, context.now);
        continue;
      }

      // El guardia contra fichas duplicadas va ANTES del envio: si dos ticks se
      // solapan, el segundo no llega a mandar nada.
      if (!(await context.introductions.markReported(row.id, context.now))) {
        continue;
      }
      marked = true;

      // El aviso se escribe ANTES de la ficha para que la ficha pueda dar el
      // numero exacto ("2/3") en vez de un "se le ha avisado" que el staff
      // tendria que ir a comprobar a mano. Si la ficha no llega a publicarse se
      // deshace abajo, junto con la marca: un aviso puesto por una ficha que
      // nadie vio se quedaria ahi para siempre Y volveria a ponerse en el
      // siguiente barrido, porque la fila vuelve a estar sin reportar.
      let aviso: {
        readonly warn: IntroductionWarnCount;
        readonly warnId: string;
      } | null = null;
      try {
        const creado = await context.warns.create({
          tenantId: row.tenantId,
          chatId: row.chatId,
          subjectTelegramUserId: row.telegramUserId,
          reason: INTRODUCTION_WARN_REASON,
        });
        warnToRevert = creado.recordId;
        const [count, limit] = await Promise.all([
          context.warns.countActive(
            row.tenantId,
            row.chatId,
            row.telegramUserId,
          ),
          context.warns.limitFor(row.chatId),
        ]);
        aviso = { warn: { count, limit }, warnId: creado.recordId };
        warned += 1;
      } catch (error) {
        // Sin aviso, pero la ficha sale igual: quien decide es una persona y
        // dejarla sin preguntar por no haber podido escribir un warn seria
        // cambiar el fallo pequeño por el grande.
        warnErrors += 1;
        failures.add(
          `warn: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }

      const title = await context.chatTitle(row.chatId).catch(() => null);
      // Los ajustes se leen ANTES de construir la ficha: la ficha dice si la
      // escalada va a seguir avisando y expulsando, y eso sale de aqui.
      const settings = await context.introductionSettings(
        row.tenantId,
        row.chatId,
      );
      const card = buildIntroductionStaffCard({
        pendingId: row.id,
        telegramUserId: row.telegramUserId,
        username: row.username,
        displayName: null,
        joinedAt: row.joinedAt,
        dueAt: row.dueAt,
        now: context.now,
        chatTitle: title,
        ...(aviso ? { warn: aviso.warn } : {}),
        ...(settings.reminderEveryHours !== null
          ? {
              escalation: {
                everyHours: settings.reminderEveryHours,
                autoKick: settings.autoKickAtLimit,
              },
            }
          : {}),
      });

      // El tema propio de las presentaciones si el grupo lo ha puesto; si no,
      // el de Guardian, que es donde han ido siempre. `??` y no `||`: el 0 no
      // es un tema válido, pero tampoco puede colarse como "no configurado".
      const tema = room.introductionThreadId ?? room.staffThreadId;
      const sent = await context.gateway.sendMessage({
        chatId: room.staffChatId,
        reply: {
          text: card,
          parseMode: "HTML",
          replyMarkup: buildIntroductionStaffKeyboard(row.id),
        },
        token,
        ...(tema !== null && tema !== undefined
          ? { messageThreadId: tema }
          : {}),
      });

      if (sent.ok) {
        reported += 1;
        marked = false; // Ya es verdad: hay ficha publicada.
        warnToRevert = null; // El aviso ya lo respalda una ficha que existe.
        // Dónde quedó la ficha, para que la escalada pueda editarla al
        // expulsar. Best-effort: sin refs la expulsión funciona igual, solo
        // que la ficha se queda sin editar.
        if (sent.messageId !== undefined) {
          await context.introductions
            .attachStaffCard(row.id, {
              staffChatId: room.staffChatId,
              staffThreadId: tema ?? null,
              staffMessageId: sent.messageId,
            })
            .catch(() => undefined);
        }
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.staff_asked",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: {
            chatId: row.chatId,
            pendingId: row.id,
            staffChatId: room.staffChatId.toString(),
            joinedAt: row.joinedAt.toISOString(),
            dueAt: row.dueAt.toISOString(),
            ...(aviso
              ? { warnCount: aviso.warn.count, warnLimit: aviso.warn.limit }
              : {}),
          },
        });

        if (aviso) {
          // Los ajustes reales del grupo (leidos arriba, junto a la ficha):
          // el aviso repite las instrucciones y pedir una foto donde el grupo
          // no la pide seria avisar a alguien por algo que nadie le pidio.
          await avisarEnElGrupo(context, row, { ...aviso, settings, token });
        }
      } else {
        errors += 1;
        failures.add("staff-card-not-sent");
      }
    } catch (error) {
      errors += 1;
      failures.add(error instanceof Error ? error.message : "unknown");
    }
    // Marcada pero sin ficha publicada: la marca dice "ya lo tiene una persona"
    // y no es cierto — nadie ha visto nada. Se deshace aqui, en un solo sitio,
    // para que cubra tanto el envio que devuelve !ok como el que lanza.
    if (marked) {
      await context.introductions.unmarkReported(row.id).catch(() => undefined);
    }
    // Y lo mismo con el aviso, por el mismo motivo y en el mismo sitio: si la
    // ficha no salio, este warn no lo respalda nada y el proximo barrido pondria
    // otro encima.
    if (warnToRevert) {
      await context.warns.revert(warnToRevert).catch(() => undefined);
      warned -= 1;
    }
  }

  // --- Fase 2: la escalada sobre las fichas ya publicadas -------------------
  //
  // Hasta agosto de 2026 una fila reportada no se volvia a mirar NUNCA: un
  // aviso a las 12 h y silencio. El resultado esta fotografiado — un tema de
  // STAFF lleno de fichas con botones que nadie pulsaba y el staff preguntando
  // si "esto no lo hace el bot solo". Ahora si: aviso periodico segun la
  // cadencia del grupo y, si el grupo lo tiene encendido, expulsion al llegar
  // al limite de warns. Presentarse sigue cortandolo todo en cualquier punto
  // (el handler de mensajes borra la fila), y los admins siguen exentos — se
  // re-comprueba aqui, en cada aviso, y no solo al abrir la ficha.
  let escalatedWarns = 0;
  let autoKicked = 0;

  const reportadas = await context.introductions.listReported();
  for (const row of reportadas) {
    try {
      const settings = await context.introductionSettings(
        row.tenantId,
        row.chatId,
      );
      if (!settings.enabled || settings.reminderEveryHours === null) {
        continue;
      }
      // El siguiente paso vence a cadencia fija desde la ficha: con N avisos
      // de escalada puestos, el (N+1)-esimo toca en reportedAt + (N+1)×cadencia.
      // Se calcula desde reportedAt y no desde "el ultimo aviso" para que un
      // barrido caido un rato no desplace toda la serie.
      const base = row.reportedAt?.getTime();
      if (base === undefined) {
        continue;
      }
      const paso = settings.reminderEveryHours * 3_600_000;
      if (context.now.getTime() < base + (row.reminders + 1) * paso) {
        continue;
      }

      const token = await context.resolveBotToken(row.tenantId);
      if (!token) {
        errors += 1;
        failures.add("missing-token");
        continue;
      }

      // Mismas salidas que en la fase 1, por los mismos motivos. La de admin
      // es la que hace legitimo expulsar desde un job: el 3-ago-2026 esto no
      // se comprobaba y el barrido echo a tres administradores.
      //
      // Y la de intocable se repite aqui igual que la de admin, no por
      // simetria: quien entro en el embudo ANTES de estar en la lista sigue
      // dentro, y sin esto la escalada le seguiria avisando hasta expulsarle.
      if (esIntocable(row.telegramUserId, context.intocables)) {
        skippedIntocable += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.skipped_untouchable",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId },
        });
        await close(row);
        continue;
      }
      const member = await context.gateway.getChatMember({
        chatId: row.telegramChatId,
        userId: row.telegramUserId,
        token,
      });
      if (member.ok && member.status && ADMIN_STATUSES.has(member.status)) {
        skippedAdmin += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.skipped_admin",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId, status: member.status },
        });
        await close(row);
        continue;
      }
      if (member.ok && member.status && GONE_STATUSES.has(member.status)) {
        alreadyGone += 1;
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.already_gone",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId, status: member.status },
        });
        await close(row);
        continue;
      }

      const limit = await context.warns.limitFor(row.chatId);
      let count = await context.warns.countActive(
        row.tenantId,
        row.chatId,
        row.telegramUserId,
      );

      if (count < limit) {
        // El guardia contra avisos duplicados va ANTES de avisar, igual que
        // `markReported` en la fase 1. Sin el, dos ticks solapados leian el
        // mismo `reminders`, los dos pasaban la comprobacion de tiempo de
        // arriba y los dos creaban aviso — y con `autoKickAtLimit` detras,
        // un aviso de mas acerca a alguien a que le echen.
        //
        // Si algo falla despues de reservar se pierde UN recordatorio, no se
        // duplica: con una escalada a expulsion detras, esa es la direccion
        // segura.
        if (
          !(await context.introductions.reclamarRecordatorio(
            row.id,
            row.reminders,
          ))
        ) {
          continue;
        }

        // Todavia hay margen: otro aviso. El warn primero y el mensaje
        // despues, como en la fase 1 — el mensaje enseña un contador que
        // tiene que existir ya.
        const creado = await context.warns.create({
          tenantId: row.tenantId,
          chatId: row.chatId,
          subjectTelegramUserId: row.telegramUserId,
          reason: INTRODUCTION_WARN_REASON,
        });
        count = await context.warns.countActive(
          row.tenantId,
          row.chatId,
          row.telegramUserId,
        );
        escalatedWarns += 1;
        // El contador de pasos avanza aunque el mensaje de despues falle: el
        // warn existe, y repetirlo en el proximo tick por un mensaje caido
        // apilaria warns de mas — el fallo pequeño en vez del grande.

        if (count < limit || !settings.autoKickAtLimit) {
          // El aviso publico, con su boton de quitar el warn — el mismo de la
          // fase 1, y con la variante de texto que dice la consecuencia real.
          await avisarEnElGrupo(context, row, {
            warn: { count, limit },
            warnId: creado.recordId,
            settings,
            token,
          });
          continue;
        }
        // El warn nuevo llego justo al limite con la expulsion encendida: el
        // aviso publico que toca ya no es "te queda uno", es el de expulsion —
        // cae abajo con el kick.
      } else if (!settings.autoKickAtLimit) {
        // Limite alcanzado y el grupo no quiere expulsion automatica: no hay
        // nada mas que avisar (un "4/3" no existe) y la ficha queda para una
        // persona. Se deja de escalar sin tocar nada.
        continue;
      }

      // Limite alcanzado y autoKickAtLimit encendido: expulsion. El mismo par
      // del boton de staff — ban de 120 s y unban — para que pueda volver a
      // entrar; menos de 30 s Telegram lo trata como permanente.
      try {
        await context.gateway.banChatMember({
          chatId: row.telegramChatId,
          userId: row.telegramUserId,
          token,
          untilDate: new Date(context.now.getTime() + 120_000),
        });
        await context.gateway.unbanChatMember({
          chatId: row.telegramChatId,
          userId: row.telegramUserId,
          token,
          onlyIfBanned: false,
        });
      } catch (error) {
        // Telegram dijo que no: la fila SE QUEDA (con sus avisos ya puestos) y
        // la ficha sigue abierta para que lo haga una persona. Nunca contar
        // como expulsado a quien sigue dentro.
        errors += 1;
        failures.add(
          `kick: ${error instanceof Error ? error.message : "unknown"}`,
        );
        await context.audit({
          tenantId: row.tenantId,
          action: "introduction.auto_kick_failed",
          resourceType: "chat_member",
          resourceId: row.telegramUserId.toString(),
          payload: { chatId: row.chatId, pendingId: row.id, count, limit },
        });
        continue;
      }

      autoKicked += 1;
      await context.audit({
        tenantId: row.tenantId,
        action: "introduction.auto_kicked",
        resourceType: "chat_member",
        resourceId: row.telegramUserId.toString(),
        payload: {
          chatId: row.chatId,
          pendingId: row.id,
          count,
          limit,
          joinedAt: row.joinedAt.toISOString(),
          dueAt: row.dueAt.toISOString(),
          reportedAt: row.reportedAt?.toISOString(),
        },
      });

      // El aviso publico en el grupo: quien mira ve por que ha salido y que
      // puede volver. Best-effort — la expulsion ya esta hecha y auditada.
      const quien = mentionHtml(
        row.telegramUserId,
        row.username ? `@${row.username}` : row.telegramUserId.toString(),
      );
      await context.gateway
        .sendMessage({
          chatId: row.telegramChatId,
          reply: {
            text: buildIntroductionKickNotice({
              who: quien,
              warn: { count, limit },
            }),
            parseMode: "HTML",
          },
          token,
        })
        .catch(() => undefined);

      // La ficha del staff se cierra sola, como la cerraria una persona: texto
      // final y sin botones. Solo si sabemos donde quedo (filas de antes de la
      // migracion no lo saben) — sin refs se queda como estaba y sus botones
      // responderan "ya no esta abierto".
      if (row.staffChatId !== null && row.staffMessageId !== null) {
        const title = await context.chatTitle(row.chatId).catch(() => null);
        const card = buildIntroductionStaffCard({
          pendingId: row.id,
          telegramUserId: row.telegramUserId,
          username: row.username,
          displayName: null,
          joinedAt: row.joinedAt,
          dueAt: row.dueAt,
          now: context.now,
          chatTitle: title,
          warn: { count, limit },
        });
        await context.gateway
          .editMessageText({
            chatId: row.staffChatId,
            messageId: row.staffMessageId,
            reply: {
              text: buildIntroductionStaffAutoResolved({
                card,
                warn: { count, limit },
              }),
              parseMode: "HTML",
              replyMarkup: { inline_keyboard: [] },
            },
            token,
          })
          .catch(() => undefined);
      }

      await close(row);
    } catch (error) {
      errors += 1;
      failures.add(error instanceof Error ? error.message : "unknown");
    }
  }

  return {
    // Solo la fase 1: es "cuantos plazos nuevos vencieron", que es lo que
    // siempre significo. La escalada cuenta aparte, en sus dos contadores.
    processed: due.length,
    // `reverted` se conserva por compatibilidad con el resumen comun de los
    // jobs; aqui significa "fichas abiertas".
    reverted: reported,
    reported,
    skippedAdmin,
    skippedIntocable,
    alreadyGone,
    noStaffChat,
    warned,
    warnErrors,
    escalatedWarns,
    autoKicked,
    errors,
    failures: [...failures].slice(0, 5),
  };
};
