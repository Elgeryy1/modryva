import type { ChatSettingRepository, SocialRepository } from "@superbot/data";
import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import {
  autoPoleVerdict,
  type Clock,
  composePaulo,
  cooldownVerdict,
  copy,
  dayPrefixFor,
  decideRound,
  displayName,
  type FunMediaKind,
  formatLatency,
  formatMuteDuration,
  kindLabel,
  latencyMsFor,
  type ModerationPort,
  normalizeSocialSettings,
  normalizeTopic,
  POLE_USAGE,
  parsePoleArgs,
  parseRouletteArgs,
  periodLabel,
  pickAsset,
  poleWindowFor,
  type RandomSource,
  ROULETTE_USAGE,
  rememberSent,
  renderSocialStatus,
  resolveConsequence,
  SOCIAL_METRICS,
  SOCIAL_SETTINGS_KEY,
  type SocialCommandName,
  type SocialScope,
  type SocialSettings,
  type SocialStatusInputs,
  scopeFor,
  streakFromWinDays,
  windowDayKey,
} from "@superbot/module-social";
import type { CounterSink } from "@superbot/shared";

/**
 * The social core's only contact with the outside world.
 *
 * Everything decided here was decided in `modules/social`; this file's job is
 * to fetch, ask, persist and reply. Keeping it in its own file rather than
 * inside bot-update.service.ts is deliberate: that file is already 697 KB, and
 * the social handlers registered there are three lines each that delegate here.
 */

/**
 * Cuántas filas ENSEÑA una clasificación.
 *
 * No es un techo sobre lo que se cuenta: la agregación la hace la base de
 * datos sobre todo el historial. Antes aquí había un límite de 2000
 * reclamaciones leídas en memoria, que a partir de ese punto recortaba el
 * ranking en silencio y sesgado hacia lo reciente.
 */
const POLE_RANKING_ROWS = 10;

/** Chat setting holding the recently-sent media ids, per kind. */
const MEDIA_RECENT_KEY = "social_media_recent";

export interface SocialAuditInput {
  readonly tenantId: string | undefined;
  readonly action: string;
  readonly actorId?: string;
  readonly resourceId?: string;
  readonly payload?: Record<string, unknown>;
}

/** Sending a picture by file_id. Nothing here ever takes a URL. */
export interface SocialMediaSender {
  sendPhotoByFileId(input: {
    readonly chatId: bigint;
    readonly fileId: string;
    readonly caption: string;
    readonly messageThreadId: number | undefined;
  }): Promise<boolean>;
}

export interface SocialHandlerDeps {
  /**
   * El interruptor MAESTRO del módulo (`SOCIAL_CORE_ENABLED`).
   *
   * En false todo entra por la puerta y sale por la misma sin tocar nada: no
   * se lee la configuración, no se consulta la base de datos y no se contesta
   * — ni siquiera para decir que está apagado. Un `/pole` en un grupo cae al
   * resto del dispatch como si el comando no existiera.
   *
   * Distinto de `settings.pole.enabled`, que decide si UN grupo lo usa. Aquel
   * responde «no está activada aquí»; este no responde nada, porque cuando la
   * función no existe todavía, mencionarla es peor que callarse.
   */
  readonly enabled: boolean;
  readonly social: SocialRepository;
  readonly chatSettings: ChatSettingRepository;
  readonly recordAudit: (input: SocialAuditInput) => Promise<void>;
  readonly moderation: ModerationPort;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly media?: SocialMediaSender;
  /**
   * Contadores del proceso. Opcional: sin él el módulo funciona igual y no
   * cuenta nada, que es lo que quieren los tests y los scripts.
   */
  readonly counters?: CounterSink;
  /** Deep link into the Mini App's social settings, or null when unavailable. */
  readonly configLink?: (telegramChatId: bigint) => string | null;
  /**
   * The live half of `/status social`.
   *
   * Answered by the caller because it owns the Telegram client and the
   * activity log. Every answer is tri-state: "I asked and it said no" and "I
   * could not ask" are different facts, and merging them sends admins to fix a
   * permission that was never the problem.
   */
  readonly statusProbe?: (
    telegramChatId: bigint,
  ) => Promise<Omit<SocialStatusInputs, "settings" | "catCount" | "dogCount">>;
}

/** What the handlers need from the update, already unpacked. */
interface SocialContext {
  readonly tenantId: string;
  /** Internal Chat row id — the key ChatSetting is stored under. */
  readonly settingsChatId: string;
  readonly telegramChatId: bigint;
  readonly topicId: number | null;
  readonly userId: bigint;
  readonly userName: string;
  readonly messageId: number | null;
  readonly isGroup: boolean;
}

const unpack = (
  context: { tenantId: string; chatId: string | undefined },
  update: TelegramUpdateEnvelope,
): SocialContext | null => {
  const telegramChatId = update.chat.chatId;
  const userId = update.user.userId;
  if (!telegramChatId || !userId || !context.chatId) {
    return null;
  }
  return {
    tenantId: context.tenantId,
    settingsChatId: context.chatId,
    telegramChatId,
    topicId: update.chat.topicId ?? null,
    userId,
    userName: displayName(update.user.firstName ?? update.user.username),
    messageId: update.messageId ?? null,
    isGroup:
      update.chat.chatType === "group" || update.chat.chatType === "supergroup",
  };
};

export class SocialHandlers {
  constructor(private readonly deps: SocialHandlerDeps) {}

  /**
   * The group's social settings, always complete.
   *
   * A missing or corrupt row yields the factory defaults rather than throwing —
   * a bad settings value must not be able to take `/pole` down for a group.
   */
  async settingsFor(tenantId: string, chatId: string): Promise<SocialSettings> {
    const raw = await this.deps.chatSettings
      .getValue(tenantId, chatId, SOCIAL_SETTINGS_KEY)
      .catch(() => undefined);
    return normalizeSocialSettings(raw);
  }

  /**
   * Every social command.
   *
   * Returns null for anything that is not ours, so the rest of the dispatch
   * chain runs untouched — including `/status` with no `social` argument, which
   * still belongs to the core handler.
   */
  async handleCommand(
    context: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    // Lo PRIMERO, antes de mirar el comando siquiera: con el módulo apagado no
    // se toca la base de datos, no se cuenta una métrica y no se contesta.
    if (!this.deps.enabled) {
      return null;
    }

    const name = update.command?.name;
    if (!name) {
      return null;
    }
    const args = update.command?.args ?? [];

    const run = async (
      label: SocialCommandName,
      handler: () => Promise<BotReply | null>,
    ): Promise<BotReply | null> => {
      const startedAt = this.deps.clock.now().getTime();
      this.count(SOCIAL_METRICS.socialCommand(label));
      try {
        return await handler();
      } finally {
        // En `finally`: un comando que falla también consume tiempo, y
        // excluirlo de la media haría que la métrica pareciera sana justo
        // cuando deja de serlo.
        const elapsed = this.deps.clock.now().getTime() - startedAt;
        this.count(SOCIAL_METRICS.commandDurationSum(label), elapsed);
        this.count(SOCIAL_METRICS.commandDurationCount(label));
      }
    };

    switch (name) {
      case "pole":
      case "poles":
        return run("pole", () => this.handlePole(context, update, args));
      case "ruleta":
      case "roulette":
        return run("ruleta", () => this.handleRoulette(context, update, args));
      case "paulo":
        return run("paulo", () => this.handlePaulo(context, update, args));
      case "gato":
      case "cat":
        return run("gato", () => this.handleFunMedia(context, update, "cat"));
      case "perro":
      case "dog":
        return run("perro", () => this.handleFunMedia(context, update, "dog"));
      case "apoyar":
      case "invitameauncafe":
        return run("apoyar", () => this.handleSupport(context, update));
      case "status":
        // Only `/status social` is ours. Plain `/status` stays with core.
        return args[0]?.toLowerCase() === "social"
          ? run("status", () => this.handleSocialStatus(context, update))
          : null;
      default:
        return null;
    }
  }

  /** Incrementa un contador, si hay sumidero. Nunca lanza. */
  private count(metric: string, by = 1): void {
    this.deps.counters?.increment(metric, by);
  }

  /**
   * «Esto se configura en otro sitio», con botón si hay enlace.
   *
   * Compartido entre pole y ruleta porque la única diferencia era la palabra,
   * y dos copias de la misma respuesta se separan en cuanto alguien toca una.
   */
  private configPointer(
    context: SocialContext,
    area: "pole" | "roulette",
  ): BotReply {
    const link = this.deps.configLink?.(context.telegramChatId) ?? null;
    return link
      ? {
          text: copy(`config.${area}.panel`),
          replyMarkup: {
            inline_keyboard: [[{ text: copy("config.button"), url: link }]],
          },
        }
      : { text: copy(`config.${area}.settings`) };
  }

  // -------------------------------------------------------------------------
  // Pole
  // -------------------------------------------------------------------------

  private async handlePole(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
    args: readonly string[],
  ): Promise<BotReply> {
    const command = parsePoleArgs(args);
    if (command.kind === "help") {
      return { text: POLE_USAGE };
    }

    const context = unpack(rawContext, update);
    if (!context?.isGroup) {
      return { text: copy("pole.private") };
    }

    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    if (!settings.pole.enabled) {
      return { text: copy("pole.disabled") };
    }

    if (command.kind === "config") {
      return this.configPointer(context, "pole");
    }

    const scope = scopeFor(
      context.tenantId,
      context.telegramChatId,
      context.topicId,
      settings.pole,
    );

    if (command.kind === "claim") {
      return this.claimPole(context, scope, settings);
    }
    return this.poleReport(context, scope, settings, command);
  }

  /** The window this scope is currently competing in, created if new. */
  private async windowFor(scope: SocialScope, settings: SocialSettings) {
    const now = this.deps.clock.now();
    const window = poleWindowFor(
      now,
      settings.pole.timezone,
      settings.pole.resetMinutes,
    );
    const record = await this.deps.social.ensureWindow({
      ...scope,
      windowType: "daily",
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      timezone: window.timezone,
      resetMinutes: window.resetMinutes,
      dayKey: windowDayKey(window),
    });
    return { now, window, record };
  }

  private async claimPole(
    context: SocialContext,
    scope: SocialScope,
    settings: SocialSettings,
  ): Promise<BotReply> {
    const { now, window, record } = await this.windowFor(scope, settings);
    const latencyMs = latencyMsFor(window, now);

    const outcome = await this.deps.social.claimPosition({
      windowId: record.id,
      userId: context.userId,
      userName: context.userName,
      messageId: context.messageId,
      latencyMs,
      positions: settings.pole.positions,
    });

    this.count(
      SOCIAL_METRICS.poleAttempt(outcome.ok ? "claimed" : outcome.reason),
    );

    if (!outcome.ok) {
      if (outcome.reason === "already-claimed") {
        this.count(SOCIAL_METRICS.duplicateUpdate("pole"));
        return {
          text: copy(
            "pole.already-claimed",
            { user: context.userName, position: outcome.position },
            this.pick("pole.already-claimed"),
          ),
        };
      }
      if (outcome.reason === "window-gone") {
        return { text: copy("pole.window-gone") };
      }
      const hh = String(Math.floor(settings.pole.resetMinutes / 60)).padStart(
        2,
        "0",
      );
      const mm = String(settings.pole.resetMinutes % 60).padStart(2, "0");
      return {
        text: copy(
          "pole.window-full",
          { reset: `${hh}:${mm}` },
          this.pick("pole.window-full"),
        ),
      };
    }

    this.count(SOCIAL_METRICS.poleClaim(outcome.claim.position));

    await this.deps.recordAudit({
      tenantId: context.tenantId,
      action: "social.pole.claimed",
      actorId: context.userId.toString(),
      resourceId: record.id,
      // Ids, position and latency only — never the message text (report §16.4).
      payload: {
        position: outcome.claim.position,
        latencyMs,
        dayKey: record.dayKey,
      },
    });

    const vars = {
      user: context.userName,
      latency: formatLatency(latencyMs),
      position: outcome.claim.position,
    };
    const key =
      outcome.claim.position === 1
        ? "pole.first"
        : outcome.claim.position === 2
          ? "pole.second"
          : outcome.claim.position === 3
            ? "pole.third"
            : "pole.other";

    const lines = [copy(key, vars, this.pick(key))];

    // A streak is only worth announcing when it is actually a streak.
    if (outcome.claim.position === 1) {
      const streak = streakFromWinDays(
        await this.deps.social.winDaysFor(scope, context.userId),
        // Acaba de ganar, así que el ganador de hoy es esta persona.
        context.userId.toString(),
        context.userId.toString(),
        record.dayKey,
      );
      if (streak >= 2) {
        lines.push(
          copy(
            "pole.streak.alive",
            { user: context.userName, days: streak },
            this.pick("pole.streak.alive"),
          ),
        );
      }
    }

    return { text: lines.join("\n") };
  }

  private async poleReport(
    context: SocialContext,
    scope: SocialScope,
    settings: SocialSettings,
    command: ReturnType<typeof parsePoleArgs>,
  ): Promise<BotReply> {
    const { window, record } = await this.windowFor(scope, settings);
    const todayKey = windowDayKey(window);

    if (command.kind === "today") {
      const claims = await this.deps.social.listWindowClaims(record.id);
      if (claims.length === 0) {
        return { text: copy("pole.no-data") };
      }
      const medals = ["🥇", "🥈", "🥉"];
      return {
        text: [
          copy("pole.today.header", { day: todayKey }),
          ...claims.map((claim) =>
            copy("pole.today.row", {
              medal: medals[claim.position - 1] ?? `${claim.position}.`,
              user: displayName(claim.userName),
              latency: formatLatency(claim.latencyMs),
            }),
          ),
        ].join("\n"),
      };
    }

    if (command.kind === "streak") {
      // Los días ganados, no las reclamaciones: acotado por el calendario y no
      // por lo mucho que juegue el grupo.
      const streak = streakFromWinDays(
        await this.deps.social.winDaysFor(scope, context.userId),
        // Que hoy la haya ganado OTRA persona rompe la racha, y eso no se ve en
        // los días propios: hay que preguntar por el podio de hoy.
        await this.todayWinnerId(record.id),
        context.userId.toString(),
        todayKey,
      );
      return {
        text:
          streak === 0
            ? copy("pole.streak.none", { user: context.userName })
            : copy(
                "pole.streak.alive",
                { user: context.userName, days: streak },
                this.pick("pole.streak.alive"),
              ),
      };
    }

    if (command.kind === "records") {
      const records = await this.deps.social.recordsFor(scope);
      if (!records.fastest && records.bestStreakDays === 0) {
        return { text: copy("pole.no-data") };
      }
      const lines = [copy("pole.records.header")];
      if (records.fastest) {
        lines.push(
          copy("pole.records.fastest", {
            user: displayName(records.fastest.userName),
            latency: formatLatency(records.fastest.latencyMs),
            day: records.fastest.dayKey,
          }),
        );
      }
      if (records.bestStreakDays > 0) {
        lines.push(
          copy("pole.records.streak", {
            user: displayName(records.bestStreakUserName),
            days: records.bestStreakDays,
          }),
        );
      }
      return { text: lines.join("\n") };
    }

    // Ranking agregado por la base de datos. `POLE_RANKING_ROWS` recorta lo que
    // se ENSEÑA; lo que se cuenta es todo el historial del grupo.
    const period = command.kind === "ranking" ? command.period : "all";
    const rows = await this.deps.social.rankingFor(
      scope,
      dayPrefixFor(period, todayKey),
      POLE_RANKING_ROWS,
    );
    if (rows.length === 0) {
      return { text: copy("pole.no-data") };
    }
    return {
      text: [
        copy("pole.ranking.header", { period: periodLabel(period) }),
        ...rows.map((row, index) =>
          copy("pole.ranking.row", {
            rank: index + 1,
            user: displayName(row.userName),
            firsts: row.firsts,
            seconds: row.seconds,
            thirds: row.thirds,
          }),
        ),
      ].join("\n"),
    };
  }

  /**
   * The automatic pole: the first eligible human message of a new window.
   *
   * Runs on every message of every group that enabled the mode, so it bails on
   * the cheapest check first — the settings read is cached by the caller's
   * dispatch, and everything before the database is a boolean.
   */
  async handleAmbientPole(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
    candidateIsEdit: boolean,
    senderIsBot: boolean,
    isAnonymousSender: boolean,
  ): Promise<BotReply | null> {
    // Este corre en CADA mensaje de cada grupo, así que el interruptor va
    // delante de todo: apagado, ni siquiera se lee la configuración.
    if (!this.deps.enabled) {
      return null;
    }
    const context = unpack(rawContext, update);
    if (!context?.isGroup) {
      return null;
    }
    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    if (!settings.pole.enabled || settings.pole.mode !== "AUTO_FIRST_MESSAGE") {
      return null;
    }

    const verdict = autoPoleVerdict(
      {
        isTextMessage: update.isTextMessage,
        hasCommand: update.command !== undefined,
        senderIsBot,
        senderUserId: update.user.userId,
        isAnonymousSender,
        isServiceMessage:
          update.newChatMemberIds.length > 0 ||
          update.leftChatMemberId !== undefined,
        hasMedia:
          update.content.hasPhoto ||
          update.content.hasVideo ||
          update.content.hasAnimation ||
          update.content.hasSticker,
        isEdit: candidateIsEdit,
      },
      settings.pole.allowMedia,
    );
    if (!verdict.eligible) {
      return null;
    }

    const scope = scopeFor(
      context.tenantId,
      context.telegramChatId,
      context.topicId,
      settings.pole,
    );
    const { now, window, record } = await this.windowFor(scope, settings);

    // Only the very first place is awarded automatically. Handing out silver
    // and bronze to whoever happens to speak next would make the bot answer
    // three times every morning, which is the flood the report warns about.
    const existing = await this.deps.social.listWindowClaims(record.id);
    if (existing.length > 0) {
      return null;
    }

    const latencyMs = latencyMsFor(window, now);
    const outcome = await this.deps.social.claimPosition({
      windowId: record.id,
      userId: context.userId,
      userName: context.userName,
      messageId: context.messageId,
      latencyMs,
      positions: 1,
    });
    if (!outcome.ok) {
      return null;
    }

    await this.deps.recordAudit({
      tenantId: context.tenantId,
      action: "social.pole.claimed",
      actorId: context.userId.toString(),
      resourceId: record.id,
      payload: { position: 1, latencyMs, dayKey: record.dayKey, mode: "auto" },
    });

    return {
      text: copy(
        "pole.first",
        { user: context.userName, latency: formatLatency(latencyMs) },
        this.pick("pole.first"),
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Roulette
  // -------------------------------------------------------------------------

  private async handleRoulette(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
    args: readonly string[],
  ): Promise<BotReply | null> {
    const command = parseRouletteArgs(args);
    if (command.kind === "help") {
      return { text: ROULETTE_USAGE };
    }

    const context = unpack(rawContext, update);
    if (!context?.isGroup) {
      return { text: copy("roulette.private") };
    }

    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    if (!settings.roulette.enabled) {
      return { text: copy("roulette.disabled") };
    }

    if (command.kind === "config") {
      return this.configPointer(context, "roulette");
    }

    if (command.kind === "status") {
      return {
        text: copy("roulette.status", {
          state: copy("roulette.state.on"),
          numerator: settings.roulette.numerator,
          denominator: settings.roulette.denominator,
          consequence:
            settings.roulette.consequence === "TEMPORARY_MUTE"
              ? copy("roulette.consequence.mute", {
                  duration: formatMuteDuration(settings.roulette.muteSeconds),
                })
              : copy("roulette.consequence.fun"),
        }),
      };
    }

    return this.spin(context, settings);
  }

  private async spin(
    context: SocialContext,
    settings: SocialSettings,
  ): Promise<BotReply | null> {
    const scope: SocialScope = {
      tenantId: context.tenantId,
      chatId: context.telegramChatId,
      threadId: context.topicId,
    };
    const now = this.deps.clock.now();

    const spins = await this.deps.social.lastSpins(scope, context.userId);
    const cooldown = cooldownVerdict(settings.roulette, spins, now);
    if (!cooldown.allowed) {
      return {
        text: copy(
          cooldown.scope === "user"
            ? "roulette.cooldown-user"
            : "roulette.cooldown-chat",
          { seconds: cooldown.waitSeconds },
          this.pick(
            cooldown.scope === "user"
              ? "roulette.cooldown-user"
              : "roulette.cooldown-chat",
          ),
        ),
      };
    }

    const decision = decideRound(settings.roulette, this.deps.random);

    // Resolve the consequence BEFORE writing anything, so the stored row says
    // what really happened rather than what was configured.
    const [isProtected, canRestrict] =
      decision.outcome === "adverse" &&
      settings.roulette.consequence === "TEMPORARY_MUTE"
        ? await Promise.all([
            this.deps.moderation.isProtected(
              context.telegramChatId,
              context.userId,
            ),
            this.deps.moderation.canRestrict(context.telegramChatId),
          ])
        : [false, false];

    const consequence =
      decision.outcome === "adverse"
        ? resolveConsequence({
            configured: settings.roulette.consequence,
            muteSeconds: settings.roulette.muteSeconds,
            botCanRestrict: canRestrict,
            targetIsProtected: isProtected,
          })
        : ({ kind: "fun" } as const);

    // Claim the message BEFORE acting. A redelivered update carries the same
    // message id, so this is what guarantees one command can never silence the
    // same person twice.
    const recorded = await this.deps.social.recordRouletteRound({
      ...scope,
      userId: context.userId,
      messageId: context.messageId ?? 0,
      numerator: decision.numerator,
      denominator: decision.denominator,
      outcome: decision.outcome,
      consequence:
        consequence.kind === "degraded" ? "degraded" : consequence.kind,
      muteSeconds: consequence.kind === "muted" ? consequence.seconds : null,
      degradedWhy: consequence.kind === "degraded" ? consequence.why : null,
      rngVersion: decision.rngVersion,
    });
    if (!recorded.ok) {
      // Already played. Staying silent is right: the person got their answer
      // the first time, and repeating it would look like a second round.
      this.count(SOCIAL_METRICS.duplicateUpdate("roulette"));
      return null;
    }

    this.count(SOCIAL_METRICS.rouletteRound(decision.outcome));
    if (consequence.kind === "muted") {
      this.count(SOCIAL_METRICS.rouletteSanction());
    }
    if (consequence.kind === "degraded") {
      this.count(SOCIAL_METRICS.restrictFailure(consequence.why));
    }

    let muteApplied: unknown = null;
    if (consequence.kind === "muted") {
      // La ronda YA está registrada, así que un fallo aquí no puede repetirse
      // en una reentrega. Lo que sí puede pasar es que Telegram agote sus
      // reintentos de 429 y la llamada acabe lanzando: eso debe convertirse en
      // "no he podido silenciarte", nunca en un handler que muere sin contestar
      // y deja al grupo mirando un comando sin respuesta.
      muteApplied = await this.deps.moderation
        .mute({
          tenantId: context.tenantId,
          chatId: context.telegramChatId,
          targetUserId: context.userId,
          seconds: consequence.seconds,
          reason: "Ruleta rusa (juego del grupo)",
        })
        .catch(() => ({ ok: false, reason: "failed" as const }));
    }

    await this.deps.recordAudit({
      tenantId: context.tenantId,
      action: "social.roulette.round",
      actorId: context.userId.toString(),
      payload: {
        outcome: decision.outcome,
        consequence: consequence.kind,
        // The probability, never the draw: publishing the draw would let
        // anyone work out when the next round is safe.
        numerator: decision.numerator,
        denominator: decision.denominator,
        rngVersion: decision.rngVersion,
        ...(consequence.kind === "muted"
          ? { muteSeconds: consequence.seconds, enforcement: muteApplied }
          : {}),
        ...(consequence.kind === "degraded"
          ? { degradedWhy: consequence.why }
          : {}),
      },
    });

    if (decision.outcome === "safe") {
      return {
        text: copy(
          "roulette.safe",
          { user: context.userName },
          this.pick("roulette.safe"),
        ),
      };
    }

    switch (consequence.kind) {
      case "fun":
        return {
          text: copy(
            "roulette.hit-fun",
            { user: context.userName },
            this.pick("roulette.hit-fun"),
          ),
        };
      case "degraded":
        return {
          text: copy(
            consequence.why === "protected"
              ? "roulette.hit-protected"
              : "roulette.hit-no-permission",
            { user: context.userName },
          ),
        };
      default: {
        // Telegram can still refuse after every check passed (the person left,
        // a race with a demotion). Announcing a silence that did not happen is
        // worse than admitting it, so the reply follows the ACTUAL outcome.
        //
        // And the duration announced is the clamped one, which is not
        // necessarily what the group typed into the settings box.
        const muteRefused =
          muteApplied !== null &&
          typeof muteApplied === "object" &&
          (muteApplied as { ok?: boolean }).ok === false;
        return {
          text: muteRefused
            ? copy("roulette.hit-no-permission", { user: context.userName })
            : copy(
                "roulette.hit-muted",
                {
                  user: context.userName,
                  duration: formatMuteDuration(consequence.seconds),
                },
                this.pick("roulette.hit-muted"),
              ),
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Paulo, cats and dogs, support
  // -------------------------------------------------------------------------

  private async handlePaulo(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
    args: readonly string[],
  ): Promise<BotReply | null> {
    const context = unpack(rawContext, update);
    if (!context) {
      return null;
    }
    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    if (!settings.fun.pauloEnabled) {
      return { text: copy("fun.disabled") };
    }
    // The first argument is a topic, never a target: `/paulo @alguien` composes
    // a general sentence rather than aiming anything at that person.
    const topic = normalizeTopic(
      args[0]?.startsWith("@") ? undefined : args[0],
    );
    return { text: composePaulo(topic, this.deps.random).text };
  }

  private async handleFunMedia(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
    kind: FunMediaKind,
  ): Promise<BotReply | null> {
    const context = unpack(rawContext, update);
    if (!context) {
      return null;
    }
    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    const enabled =
      kind === "cat" ? settings.fun.catsEnabled : settings.fun.dogsEnabled;
    if (!enabled) {
      return { text: copy("fun.disabled") };
    }

    const library = await this.deps.social.listMediaAssets(
      context.tenantId,
      kind,
    );
    const recent = await this.recentMedia(context, kind);
    const picked = pickAsset(
      library.map((asset) => ({
        id: asset.id,
        kind,
        source: asset.source,
        licence: asset.licence,
        attribution: asset.attribution,
        active: asset.active,
        safetyStatus: asset.safetyStatus as "approved",
      })),
      kind,
      recent,
      this.deps.random,
    );
    if (!picked.ok) {
      this.count(SOCIAL_METRICS.media("empty-library"));
      return { text: copy("fun.media.empty", { kind: kindLabel(kind) }) };
    }

    // Only a file_id this bot itself uploaded can be sent: Telegram binds a
    // file_id to the token that produced it, so a child bot cannot reuse the
    // parent's. Without one there is nothing to send, and saying so is better
    // than a silent failure.
    const fileId = await this.deps.social.findMediaFileId(
      picked.asset.id,
      context.tenantId,
    );
    if (!fileId || !this.deps.media) {
      this.count(SOCIAL_METRICS.media("no-file-id"));
      return { text: copy("fun.media.empty", { kind: kindLabel(kind) }) };
    }

    const captionKey = kind === "cat" ? "fun.cat.caption" : "fun.dog.caption";
    const sent = await this.deps.media.sendPhotoByFileId({
      chatId: context.telegramChatId,
      fileId,
      caption: copy(captionKey, {}, this.pick(captionKey)),
      messageThreadId: context.topicId ?? undefined,
    });
    if (!sent) {
      this.count(SOCIAL_METRICS.media("failed"));
      return { text: copy("fun.media.empty", { kind: kindLabel(kind) }) };
    }

    this.count(SOCIAL_METRICS.media("sent"));
    // Only a delivered picture rolls the exclusion window forward: a failed
    // send must not push an unseen asset out of it.
    await this.rememberMedia(context, kind, picked.asset.id, recent);
    return null;
  }

  private async recentMedia(
    context: SocialContext,
    kind: FunMediaKind,
  ): Promise<readonly string[]> {
    const raw = await this.deps.chatSettings
      .getValue(context.tenantId, context.settingsChatId, MEDIA_RECENT_KEY)
      .catch(() => undefined);
    if (typeof raw !== "object" || raw === null) {
      return [];
    }
    const list = (raw as Record<string, unknown>)[kind];
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  }

  private async rememberMedia(
    context: SocialContext,
    kind: FunMediaKind,
    assetId: string,
    recent: readonly string[],
  ): Promise<void> {
    const raw = await this.deps.chatSettings
      .getValue(context.tenantId, context.settingsChatId, MEDIA_RECENT_KEY)
      .catch(() => undefined);
    const base =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    await this.deps.chatSettings
      .setValue(context.tenantId, context.settingsChatId, MEDIA_RECENT_KEY, {
        ...base,
        [kind]: rememberSent(recent, assetId),
      })
      .catch(() => undefined);
  }

  private async handleSupport(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const context = unpack(rawContext, update);
    if (!context) {
      return null;
    }
    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    if (settings.supportUrl.length === 0) {
      return { text: copy("support.none") };
    }
    return {
      text: copy("support.link", { url: settings.supportUrl }),
      disableWebPagePreview: true,
    };
  }

  /**
   * `/status social` — the diagnostic screen.
   *
   * The live checks are answered by `statusProbe` because the caller owns the
   * Telegram client and the activity log. When no probe is wired the screen
   * still renders, with every permission reported as "could not check" rather
   * than inventing a green tick.
   */
  private async handleSocialStatus(
    rawContext: { tenantId: string; chatId: string | undefined },
    update: TelegramUpdateEnvelope,
  ): Promise<BotReply | null> {
    const context = unpack(rawContext, update);
    if (!context?.isGroup) {
      return { text: copy("mod.group-only") };
    }
    const settings = await this.settingsFor(
      context.tenantId,
      context.settingsChatId,
    );
    const probed = await this.deps
      .statusProbe?.(context.telegramChatId)
      .catch(() => null);
    const [cats, dogs] = await Promise.all([
      this.deps.social.listMediaAssets(context.tenantId, "cat"),
      this.deps.social.listMediaAssets(context.tenantId, "dog"),
    ]);

    return {
      text: renderSocialStatus({
        settings,
        botIsAdmin: probed?.botIsAdmin ?? "unknown",
        canRestrict: probed?.canRestrict ?? "unknown",
        canDelete: probed?.canDelete ?? "unknown",
        seesPlainMessages: probed?.seesPlainMessages ?? "unknown",
        isForum: probed?.isForum ?? false,
        catCount: cats.length,
        dogCount: dogs.length,
        telegramLatencyMs: probed?.telegramLatencyMs ?? null,
      }),
    };
  }

  /**
   * Quién tiene la pole de hoy, o null si sigue libre.
   *
   * Una consulta a la ventana actual, no al historial: es el único dato que
   * los días ganados por una persona no pueden contener, y sin él una racha
   * que ya se ha perdido se seguiría anunciando.
   */
  private async todayWinnerId(windowId: string): Promise<string | null> {
    const claims = await this.deps.social.listWindowClaims(windowId);
    const winner = claims.find((claim) => claim.position === 1);
    return winner ? winner.userId.toString() : null;
  }

  /** Deterministic-ish variant choice: a draw, so tests can fix it. */
  private pick(key: string): number {
    return this.deps.random.int(0, Math.max(1, key.length * 7));
  }
}
