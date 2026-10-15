import {
  type GuardianSettingsState,
  InMemoryGuardianRepository,
  type VerificationSessionRecord,
} from "@superbot/data";
import {
  parseStaffCallbackData,
  STAFF_MIRROR_CALLBACK,
} from "@superbot/module-guardian";
import { describe, expect, it } from "vitest";
import {
  type GuardianVerifyDeps,
  GuardianVerifyService,
} from "./guardian-verify.service.js";

/**
 * The STAFF report can be mirrored to several rooms. A real end-to-end check
 * needs a human doing a camera challenge, so what is pinned here is the part
 * that can actually be wrong on its own: WHERE the copies go, that every one is
 * recorded so retention can delete it later, that one room failing cannot take
 * the others — or the primary report — down with it, and that only the primary
 * room is handed buttons that act.
 */

interface SentMessage {
  chatId: bigint;
  messageThreadId?: number;
  markup?: unknown;
  body?: string;
}

const makeGateway = (refuse: ReadonlySet<string> = new Set()) => {
  const sent: SentMessage[] = [];
  let nextMessageId = 100;
  const send = async (
    input: SentMessage & {
      replyMarkup?: unknown;
      caption?: string;
      reply?: { replyMarkup?: unknown; text?: string };
    },
  ) => {
    if (refuse.has(input.chatId.toString())) {
      throw new Error(
        "Telegram sendMessage failed with status 400: CHAT_ADMIN_REQUIRED",
      );
    }
    // sendPhoto carries the keyboard at the top level, sendMessage nests it
    // under `reply`. Both shapes reach this one double.
    const markup = input.replyMarkup ?? input.reply?.replyMarkup;
    const body = input.caption ?? input.reply?.text;
    sent.push({
      chatId: input.chatId,
      ...(body !== undefined ? { body } : {}),
      ...(input.messageThreadId !== undefined
        ? { messageThreadId: input.messageThreadId }
        : {}),
      ...(markup !== undefined ? { markup } : {}),
    });
    nextMessageId += 1;
    return { ok: true, skipped: false, messageId: nextMessageId };
  };
  return {
    sent,
    gateway: {
      sendMessage: send,
      sendPhoto: send,
    },
  };
};

/**
 * Every action a keyboard can trigger, named. URL buttons contribute nothing —
 * they cannot act on the session — and the inert lock is reported as "lock".
 *
 * Asserting on actions rather than on button labels is deliberate: a copy that
 * kept a working ❌ under a renamed label would still pass a text-based check.
 */
const actionsOf = (markup: unknown): string[] => {
  const rows =
    (markup as { inline_keyboard?: { callback_data?: string }[][] })
      ?.inline_keyboard ?? [];
  return rows.flat().flatMap((button) => {
    if (!button.callback_data) {
      return [];
    }
    if (button.callback_data === STAFF_MIRROR_CALLBACK) {
      return ["lock"];
    }
    return [parseStaffCallbackData(button.callback_data)?.action ?? "unknown"];
  });
};

const settings = (
  extraStaffChats: { chatId: string; threadId: number | null }[],
): GuardianSettingsState =>
  ({
    staffChatId: -1001n,
    staffThreadId: null,
    extraStaffChats,
    protectStaffContent: false,
    keepStaffPhotos: false,
    mediaRetentionHours: 72,
    locale: "es",
  }) as unknown as GuardianSettingsState;

const newSession = async (
  repo: InMemoryGuardianRepository,
): Promise<VerificationSessionRecord> => {
  const session = await repo.createSession({
    tenantId: "t1",
    chatId: "c1",
    telegramChatId: -100n,
    telegramUserId: 42n,
    mode: "manual",
    challengeDefinition: { steps: [] },
    challengeNonce: `nonce-${Math.random()}`,
    sessionTokenHash: `hash-${Math.random()}`,
    expiresAt: new Date(Date.now() + 600_000),
    idempotencyKey: `idem-${Math.random()}`,
  });
  if (!session) {
    throw new Error("fixture: session was not created");
  }
  return session;
};

/** sendStaffReport is private; this exercises it as the service really calls
 * it, without pretending the method is public API. */
const report = async (
  service: GuardianVerifyService,
  session: VerificationSessionRecord,
  state: GuardianSettingsState,
): Promise<void> => {
  await (
    service as unknown as {
      sendStaffReport: (
        s: VerificationSessionRecord,
        set: GuardianSettingsState,
        decision: string,
        reason: string,
        signals: unknown,
      ) => Promise<void>;
    }
  ).sendStaffReport(session, state, "manual_review", "needs_human", {});
};

const serviceWith = (
  repo: InMemoryGuardianRepository,
  gateway: unknown,
): GuardianVerifyService =>
  new GuardianVerifyService({
    repo,
    gateway,
    sessionSecret: "s3cret",
    primaryToken: "bot:token",
    managedBotTokenKey: "k",
    // The report names the community chat, so the lookup has to answer.
    foundation: {
      findChatByTelegramId: async () => ({ chatId: "c1", title: "Grupo" }),
    },
  } as unknown as GuardianVerifyDeps);

describe("sendStaffReport — mirroring to several rooms", () => {
  it("delivers to the primary room and to every extra", async () => {
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([
        { chatId: "-1002", threadId: null },
        { chatId: "-1003", threadId: 6 },
      ]),
    );

    expect(sent.map((s) => s.chatId.toString())).toEqual([
      "-1001",
      "-1002",
      "-1003",
    ]);
    // The forum topic of a mirror must be honoured, not just the primary's.
    expect(sent[2]?.messageThreadId).toBe(6);
  });

  it("records every copy, so retention can delete them all", async () => {
    // Without a row per copy, a face photo stays in the mirror rooms forever.
    const repo = new InMemoryGuardianRepository();
    const { gateway } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    const copies = await repo.listStaffReportCopies(session.id);
    expect(copies).toHaveLength(2);
    expect(copies.filter((c) => c.isPrimary)).toHaveLength(1);
    expect(copies.map((c) => c.telegramChatId.toString()).sort()).toEqual([
      "-1001",
      "-1002",
    ]);
  });

  it("one mirror refusing does not stop the others", async () => {
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway(new Set(["-1002"]));
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([
        { chatId: "-1002", threadId: null },
        { chatId: "-1003", threadId: null },
      ]),
    );

    expect(sent.map((s) => s.chatId.toString())).toEqual(["-1001", "-1003"]);
  });

  it("a failing mirror never undoes the primary report", async () => {
    // The primary has already landed by the time mirrors run. Letting a mirror
    // error escape would lose the record of a report STAFF can already see.
    const repo = new InMemoryGuardianRepository();
    const { gateway } = makeGateway(new Set(["-1002"]));
    const session = await newSession(repo);

    await expect(
      report(
        serviceWith(repo, gateway),
        session,
        settings([{ chatId: "-1002", threadId: null }]),
      ),
    ).resolves.toBeUndefined();

    const copies = await repo.listStaffReportCopies(session.id);
    expect(copies.map((c) => c.telegramChatId.toString())).toEqual(["-1001"]);
  });

  it("gives the decision buttons to the primary room only", async () => {
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([
        { chatId: "-1002", threadId: null },
        { chatId: "-1003", threadId: null },
      ]),
    );

    expect(actionsOf(sent[0]?.markup)).toEqual(
      expect.arrayContaining(["approve", "decline"]),
    );
    for (const mirror of sent.slice(1)) {
      const actions = actionsOf(mirror.markup);
      // Exact, not "does not contain approve": a new acting button added to the
      // report later must fail here rather than reach the mirrors unnoticed.
      expect(actions).toEqual(["lock", "report"]);
    }
  });

  it("locks every mirror visibly instead of leaving it bare", async () => {
    // An empty keyboard reads as "the buttons failed to load"; the whole point
    // is that STAFF in a mirror can tell where the case is decided.
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    expect(actionsOf(sent[1]?.markup)).toContain("lock");
  });

  it("stamps the retention pointer, without which nothing is ever deleted", async () => {
    const repo = new InMemoryGuardianRepository();
    const { gateway } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    const after = await repo.findSessionById(session.id);
    // All three, because listSessionsWithExpiredStaffReport filters on all
    // three — any one missing and the whole fan-out is unreachable.
    expect(after?.staffChatId).toBe(-1001n);
    expect(after?.staffReportMessageId).not.toBeNull();
    expect(after?.staffReportDeleteAfter).not.toBeNull();
  });

  it("still stamps the pointer when another write wins the version race", async () => {
    // The realistic race: a STAFF decision or a progress write lands while the
    // report is still being sent. resolveSession is optimistic, so the stamp
    // becomes a silent no-op — and the photo, in every mirrored room, silently
    // stops being covered by the retention promise printed on the report.
    const repo = new InMemoryGuardianRepository();
    const { gateway } = makeGateway();
    const session = await newSession(repo);

    await repo.resolveSession(session.id, session.version, {
      status: session.status,
    });

    // `session` now carries a stale version, exactly as the real caller would.
    await report(
      serviceWith(repo, gateway),
      session,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    const after = await repo.findSessionById(session.id);
    expect(after?.staffReportMessageId).not.toBeNull();
    expect(after?.staffReportDeleteAfter).not.toBeNull();
    // And the mirror is recorded, so retention reaches it once the session is
    // listed at all.
    const copies = await repo.listStaffReportCopies(session.id);
    expect(copies.map((c) => c.telegramChatId.toString()).sort()).toEqual([
      "-1001",
      "-1002",
    ]);
  });

  it("keeps the connection block out of every mirror", async () => {
    // End to end, not just the pure redactor: the mirrors must receive the
    // REDACTED body, and the primary must still receive the full one.
    //
    // Se comprueba con el pais y no con la IP: la IP en crudo ya no se imprime
    // en NINGUN informe, ni en el principal, asi que como testigo solo diria
    // que ambos la ocultan — que es cierto pero no es lo que este test vigila.
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);
    await repo.setSessionIpIfUnset(session.id, "203.0.113.44");
    await repo.setSessionCountryIfUnset(session.id, "ES");
    const fresh = await repo.findSessionById(session.id);
    if (!fresh) {
      throw new Error("fixture: session vanished");
    }

    await report(
      serviceWith(repo, gateway),
      fresh,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    expect(sent[0]?.body).toContain("🌍 ES");
    expect(sent[1]?.body).not.toContain("🌍 ES");
    // Y la IP en crudo no sale por ningun lado, principal incluido.
    for (const mensaje of sent) {
      expect(mensaje.body).not.toContain("203.0.113.44");
    }
  });

  it("still tells the mirror what happened", async () => {
    // Redaction must not hollow the report out — a mirror that says nothing
    // useful is worse than no mirror.
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);

    await report(
      serviceWith(repo, gateway),
      session,
      settings([{ chatId: "-1002", threadId: null }]),
    );

    expect(sent[1]?.body).toContain("Verificación Guardian");
    expect(sent[1]?.body).toContain("Grupo");
  });

  it("behaves exactly as before when no extra rooms are configured", async () => {
    const repo = new InMemoryGuardianRepository();
    const { gateway, sent } = makeGateway();
    const session = await newSession(repo);

    await report(serviceWith(repo, gateway), session, settings([]));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId.toString()).toBe("-1001");
  });
});
