/**
 * Un worker social independiente, para la prueba de carrera entre procesos.
 *
 * Qué es REAL aquí: el proceso (OS distinto), la conexión (PrismaClient
 * propio), el repositorio (`PrismaSocialRepository` contra Postgres de verdad),
 * los ajustes (`PrismaChatSettingRepository`), la auditoría (filas en
 * `audit_logs`) y el handler (`SocialHandlers`, el mismo que corre en el bot).
 *
 * Qué NO es real: no se llama a Telegram. El "anuncio" es el BotReply que el
 * handler devuelve, que es exactamente lo que el bot enviaría — así se puede
 * contar cuántos anuncios se INTENTAN sin tocar la red.
 *
 * Redis no aparece porque el Social Core no lo usa: los cooldowns salen de
 * `roulette_rounds` y la ventana se calcula, no se cachea. Decirlo es más útil
 * que levantar un Redis que nadie consultaría.
 *
 * Uso:
 *   tsx worker.ts <label> <startAtEpochMs> <userId>
 * Escribe UNA línea JSON en stdout y termina con código 0.
 */

import { PrismaClient } from "@prisma/client";
import {
  PrismaChatSettingRepository,
  PrismaSocialRepository,
} from "@superbot/data";
import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { fixedClock, sequenceRandom } from "@superbot/module-social";
import { SocialHandlers } from "../../apps/bot/src/handlers/social.js";

const [label, startAtRaw, userIdRaw] = process.argv.slice(2);

const TENANT = "tenant-two-workers";
const CHAT_ROW = "chat-two-workers";
const CHAT = -1009999n;
/** Instante fijo para los dos workers: la misma ventana de pole, seguro. */
const NOW = new Date("2026-07-30T10:00:00.000Z");

const emit = (payload: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify({ label, ...payload })}\n`);
};

const main = async (): Promise<void> => {
  const client = new PrismaClient({
    datasourceUrl: process.env.TEST_DATABASE_URL,
  });

  const handlers = new SocialHandlers({
    social: new PrismaSocialRepository(client),
    chatSettings: new PrismaChatSettingRepository(client),
    recordAudit: async (input) => {
      await client.auditLog.create({
        data: {
          tenantId: input.tenantId ?? null,
          actorType: "user",
          action: input.action,
          resourceType: "social",
          actorId: input.actorId ?? null,
          resourceId: input.resourceId ?? null,
          payload: (input.payload ?? {}) as never,
        },
      });
    },
    moderation: {
      canRestrict: async () => false,
      isProtected: async () => false,
      mute: async () => ({ ok: false, reason: "no-permission" }),
    },
    clock: fixedClock(NOW),
    random: sequenceRandom([0]),
  });

  const update = {
    updateId: Number(userIdRaw),
    kind: "message",
    receivedAt: NOW,
    chat: { chatId: CHAT, chatType: "supergroup", topicId: undefined },
    user: {
      userId: BigInt(userIdRaw ?? "0"),
      username: `u${userIdRaw}`,
      firstName: `U${userIdRaw}`,
      languageCode: "es",
    },
    command: { name: "pole", raw: "/pole", args: [] },
    callbackData: undefined,
    messageText: "/pole",
    content: {
      hasText: true,
      hasUrl: false,
      hasMention: false,
      isForward: false,
      viaBot: false,
      hasPhoto: false,
      hasVideo: false,
      hasAnimation: false,
      hasSticker: false,
      hasAudio: false,
      hasVoice: false,
      hasDocument: false,
      hasContact: false,
      hasLocation: false,
      hasPoll: false,
    },
    attachment: undefined,
    preCheckout: undefined,
    successfulPayment: undefined,
    inlineQuery: undefined,
    messageId: Number(userIdRaw),
    newChatMemberIds: [],
    isTextMessage: true,
    raw: {},
  } as unknown as TelegramUpdateEnvelope;

  // Conectar y calentar ANTES de la barrera, para que el arranque de Prisma no
  // se cuele dentro de la ventana de la carrera.
  await client.$queryRaw`SELECT 1`;

  const startAt = Number(startAtRaw);
  // Espera activa el último tramo: setTimeout tiene una resolución de ~15 ms en
  // Windows, suficiente para que los dos procesos no coincidan de verdad.
  while (Date.now() < startAt) {
    /* spin */
  }

  const began = Date.now();
  try {
    const reply = await handlers.handleCommand(
      { tenantId: TENANT, chatId: CHAT_ROW },
      update,
    );
    emit({
      ok: true,
      firedAt: began,
      // El anuncio que el bot ENVIARÍA. Contarlos es contar los anuncios.
      announced: reply !== null,
      wonPole: Boolean(reply?.text?.includes("🥇")),
      text: reply?.text ?? null,
    });
  } catch (error) {
    emit({
      ok: false,
      firedAt: began,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await client.$disconnect();
  }
};

main().then(
  () => process.exit(0),
  (error: unknown) => {
    emit({ ok: false, fatal: String(error) });
    process.exit(1);
  },
);
