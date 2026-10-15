import type { ChatSettingRepository, EconomyRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import {
  decidePurge,
  formatCurrency,
  GROUP_CURRENCY_SETTINGS_KEY,
  PURGE_SETTINGS_KEY,
  PURGE_STATE_KEY,
  parseGroupCurrencySettings,
  parsePurgeSettings,
  parsePurgeState,
  renderPurgeBoard,
} from "@superbot/module-games";
import type { TelegramGatewayResult } from "@superbot/telegram";
import type { PublishGateway } from "./expiration-processor.js";

/**
 * economy.purge.tick — abre y cierra la purga de cada grupo que la tenga
 * encendida.
 *
 * Corre en el tick de 60 s del worker, como el resto. Un minuto de resolucion
 * basta: la purga dura cinco, asi que como mucho se abre 59 s tarde, y a cambio
 * no hace falta un job programado por grupo que habria que reprogramar cada vez
 * que un admin toca los ajustes.
 *
 * La hora la sortea `decidePurge` UNA vez y se guarda. Volver a sortearla en
 * cada tick moveria el objetivo cada minuto y la purga no llegaria nunca.
 */
/**
 * Como el de publicar de siempre, pero devolviendo el id del mensaje.
 *
 * Tipo propio en vez de ampliar `PublishGateway`: aquel lo comparten el recap y
 * el anuncio de trivia, que mandan y se olvidan. Aqui el id ES el mecanismo —
 * sin el no hay marcador que editar.
 */
export interface PurgePublishGateway extends PublishGateway {
  sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult & { messageId?: number }>;
}

export interface PurgeContext {
  readonly chatSetting: ChatSettingRepository;
  readonly economy: EconomyRepository;
  readonly gateway: PurgePublishGateway;
  readonly nowMs: number;
  /** Tirada en [0,1) para sortear la proxima hora. Inyectada para poder fijarla
   * en los tests. */
  random(): number;
  resolveChatTelegramId(chatId: string): Promise<bigint | undefined>;
  resolveBotToken(tenantId: string): Promise<string | undefined>;
  /**
   * Nombres para el resumen. Sin esto el mensaje sale con ids crudos
   * ("1000000001 — 5.178"), que no le dice nada a nadie y arruina justo la
   * parte del evento de la que se habla al dia siguiente.
   */
  resolveNames(ids: readonly bigint[]): Promise<Map<string, string>>;
}

/** El nombre de alguien, o su id si no lo sabemos. */
const nombreDe = (id: bigint, nombres: Map<string, string>): string =>
  nombres.get(id.toString()) ?? id.toString();

export interface PurgeSummary {
  scanned: number;
  scheduled: number;
  opened: number;
  closed: number;
  errors: number;
}

export const processPurges = async (
  ctx: PurgeContext,
): Promise<PurgeSummary> => {
  const summary: PurgeSummary = {
    scanned: 0,
    scheduled: 0,
    opened: 0,
    closed: 0,
    errors: 0,
  };

  const entradas = await ctx.chatSetting.listByKey(PURGE_SETTINGS_KEY);
  for (const entrada of entradas) {
    summary.scanned += 1;
    try {
      const settings = parsePurgeSettings(entrada.value);
      const state = parsePurgeState(
        await ctx.chatSetting.getValue(
          entrada.tenantId,
          entrada.chatId,
          PURGE_STATE_KEY,
        ),
      );
      const accion = decidePurge({
        settings,
        state,
        nowMs: ctx.nowMs,
        roll: ctx.random(),
      });

      if (accion.kind === "none") {
        continue;
      }

      if (accion.kind === "schedule") {
        await ctx.chatSetting.setValue(
          entrada.tenantId,
          entrada.chatId,
          PURGE_STATE_KEY,
          { scheduledForMs: accion.scheduledForMs },
        );
        summary.scheduled += 1;
        continue;
      }

      const telegramChatId = await ctx.resolveChatTelegramId(entrada.chatId);
      const token = await ctx.resolveBotToken(entrada.tenantId);
      const currency = parseGroupCurrencySettings(
        await ctx.chatSetting.getValue(
          entrada.tenantId,
          entrada.chatId,
          GROUP_CURRENCY_SETTINGS_KEY,
        ),
      );

      if (accion.kind === "open") {
        // El estado se escribe ANTES de anunciar. Si fuera al reves y el envio
        // fallara a medias, el siguiente tick volveria a abrirla y el grupo
        // recibiria el anuncio dos veces.
        await ctx.chatSetting.setValue(
          entrada.tenantId,
          entrada.chatId,
          PURGE_STATE_KEY,
          { openedAtMs: ctx.nowMs },
        );
        summary.opened += 1;
        if (telegramChatId) {
          // Este mensaje ES el marcador: a partir de aqui el bot lo edita con
          // cada golpe en vez de mandar uno nuevo. Por eso hace falta su id, y
          // por eso se guarda en cuanto se conoce.
          const enviado = await ctx.gateway.sendMessage({
            chatId: telegramChatId,
            reply: {
              parseMode: "HTML",
              text: renderPurgeBoard({
                remainingSeconds: settings.durationMinutes * 60,
                totalMoved: 0,
                plays: [],
                top: [],
                formatAmount: (n) => formatCurrency(n, currency),
              }),
            },
            token,
          });
          if (enviado.messageId !== undefined) {
            await ctx.chatSetting.setValue(
              entrada.tenantId,
              entrada.chatId,
              PURGE_STATE_KEY,
              { openedAtMs: ctx.nowMs, boardMessageId: enviado.messageId },
            );
          }
          // Si no se pudo publicar, el bot lo detecta por la ausencia de
          // `boardMessageId` y vuelve a responder con un mensaje por robo: sin
          // marcador es mejor ruido que silencio.
        }
        continue;
      }

      // Cierre: primero el estado, luego el resumen.
      const abiertaMs = state.openedAtMs ?? ctx.nowMs;
      await ctx.chatSetting.setValue(
        entrada.tenantId,
        entrada.chatId,
        PURGE_STATE_KEY,
        { scheduledForMs: accion.scheduledForMs },
      );
      summary.closed += 1;

      if (!telegramChatId) {
        continue;
      }
      const [ladrones, victimas] = await Promise.all([
        ctx.economy.rankByReasonBetween(
          entrada.tenantId,
          entrada.chatId,
          "steal-win",
          new Date(abiertaMs),
          new Date(ctx.nowMs),
          3,
        ),
        ctx.economy.rankByReasonBetween(
          entrada.tenantId,
          entrada.chatId,
          "steal-loss",
          new Date(abiertaMs),
          new Date(ctx.nowMs),
          3,
        ),
      ]);
      const movido = ladrones.reduce((suma, fila) => suma + fila.balance, 0);
      const nombres = await ctx
        .resolveNames([
          ...ladrones.map((f) => f.userTelegramId),
          ...victimas.map((f) => f.userTelegramId),
        ])
        // Un fallo al resolver nombres no puede tumbar el resumen: se cae a los
        // ids, que es feo pero sigue contando lo que paso.
        .catch(() => new Map<string, string>());

      await ctx.gateway.sendMessage({
        chatId: telegramChatId,
        reply: {
          text:
            ladrones.length === 0
              ? "🕊️ Se acabó la purga. Nadie robó nada: o mucha paz, o mucho miedo."
              : [
                  "🔒 *Se acabó la purga.*",
                  "",
                  `Se movieron ${formatCurrency(movido, currency)}.`,
                  "",
                  "🥷 Quien más robó:",
                  ...ladrones.map(
                    (fila, i) =>
                      `${i + 1}. ${nombreDe(fila.userTelegramId, nombres)} — ${formatCurrency(fila.balance, currency)}`,
                  ),
                  ...(victimas.length > 0
                    ? [
                        "",
                        "💸 Quien más perdió:",
                        ...victimas.map(
                          (fila, i) =>
                            `${i + 1}. ${nombreDe(fila.userTelegramId, nombres)} — ${formatCurrency(fila.balance, currency)}`,
                        ),
                      ]
                    : []),
                ].join("\n"),
          parseMode: "Markdown",
        },
        token,
      });
    } catch {
      // Un grupo que falla no puede dejar sin purga a los demas.
      summary.errors += 1;
    }
  }

  return summary;
};
