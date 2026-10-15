import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  AyudanteSolicitudRepositoryPrisma,
  PrismaCaptchaRepository,
  PrismaChatActivityRepository,
  PrismaChatSettingRepository,
  PrismaChipRepository,
  PrismaEconomyRepository,
  PrismaExpirationRepository,
  PrismaFeedRepository,
  PrismaFoundationRepository,
  PrismaGuardianRepository,
  PrismaIntroductionRepository,
  PrismaMessageLogRepository,
  PrismaModerationExtraRepository,
  PrismaModerationRepository,
  PrismaPetRepository,
  PrismaPlatformRepository,
  PrismaProductivityRepository,
  PrismaRetentionRepository,
  PrismaScheduledPostRepository,
  PrismaWebhookRepository,
  prisma,
} from "@superbot/data";
import { buildAiProviderFromEnv } from "@superbot/module-ai";
import {
  INTRODUCTION_SETTINGS_KEY,
  parseIntroductionSettings,
} from "@superbot/module-community";
import { createStorageDriverFromEnv } from "@superbot/module-files";
import {
  esEspecieId,
  PETS_SETTINGS_KEY,
  textoDeAvisoDeSalud,
  textoDeSubidasDelDia,
} from "@superbot/module-games";
import { getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import { Queue, Worker } from "bullmq";
import Fastify from "fastify";
import IORedis from "ioredis";
import { processStaleDuels } from "./duel-processor.js";
import {
  type ExpirationContext,
  processCaptchaExpirations,
  processExpiredManagedBots,
  processReminders,
  processSanctionExpirations,
  processScheduledPosts,
  processWarningExpirations,
} from "./expiration-processor.js";
import {
  processGuardianMediaRetention,
  processGuardianSessionExpirations,
  processGuardianStaffMessageRetention,
  processIntroductionSweep,
} from "./guardian-processor.js";
import { processMessageMedia } from "./message-media-processor.js";
import { procesarTickDeMascotas } from "./pets-tick.js";
import { processPurges } from "./purge-processor.js";
import { processWeeklyRecap } from "./recap-processor.js";
import {
  auditLogTarget,
  chatActivityTarget,
  processRetention,
  updateInboxTarget,
} from "./retention.js";
import { type FeedFetcher, processFeeds } from "./rss-processor.js";
import { processTriviaAnnouncements } from "./trivia-announce-processor.js";
import { fetchPublicOnly } from "./url-guard.js";
import {
  processWebhookDeliveries,
  type WebhookFetcher,
} from "./webhook-processor.js";

const queueName = "superbot-jobs";

// `fetchPublicOnly` en vez de `assertPublicHttpUrl` + `fetch`: el segundo
// validaba el primer salto y luego dejaba que `fetch` siguiera hasta 20
// redirecciones sin mirar ninguna. Ver url-guard.ts.
const defaultWebhookFetcher: WebhookFetcher = async (url, init) => {
  const response = await fetchPublicOnly(url, init);
  return { ok: response.ok, status: response.status };
};

const defaultFeedFetcher: FeedFetcher = async (url) => {
  const response = await fetchPublicOnly(url, {
    headers: { accept: "application/rss+xml, application/atom+xml, text/xml" },
  });
  if (!response.ok) {
    throw new Error(`feed fetch failed: ${response.status}`);
  }
  return response.text();
};

export const expirationJobNames = [
  "moderation.sanction.expire",
  "captcha.challenge.expire",
  "warning.expire",
  "post.publish.due",
  "reminder.fire.due",
  "rss.poll.due",
  "webhook.deliver.due",
  "managedbot.expire",
  "games.trivia.announce",
  "community.recap.weekly",
  "guardian.session.expire",
  "guardian.media.retention_cleanup",
  "guardian.staff_message.retention_cleanup",
  // Removes newcomers past their introduction deadline. Runs on the same tick
  // as the rest: a sweep that only fires hourly is fine for a 12 h deadline.
  "community.introduction_sweep",
  "casino.duel.expire",
  // Pone techo a `update_inbox`: 45.333 filas y 51 MB (el 43% de la base de
  // datos) desde el 29 de junio, con el payload crudo de Telegram dentro y sin
  // que nada las borrara nunca.
  "inbox.retention_cleanup",
  // Lo mismo para `audit_logs` (22 MB) y `chat_activity_events` (23 MB). Job
  // aparte y no metido en el de arriba porque el nombre tiene que seguir
  // diciendo la verdad de lo que borra.
  "data.retention_cleanup",
  // Baja los ficheros de los mensajes archivados. La cola es el propio estado
  // de message_log: fila con file_id y sin clave de almacen.
  "messages.media_fetch",
  // Abre y cierra la purga de cada grupo. Un minuto de resolucion basta para un
  // evento de cinco: se abre 59 s tarde como mucho, y a cambio no hace falta un
  // job por grupo que reprogramar cada vez que alguien toca los ajustes.
  "economy.purge.tick",
  // Les pasa el tiempo a las mascotas y les paga el dia. Cada minuto, en lotes:
  // el hambre baja 3 puntos por hora, asi que hay horas de holgura y da igual
  // que un grupo se procese cuarenta segundos tarde.
  "pets.tick",
] as const;

export type ExpirationJobName = (typeof expirationJobNames)[number];

const buildExpirationContext = (
  env: ReturnType<typeof getRuntimeEnv>,
): ExpirationContext => {
  const guardian = new PrismaGuardianRepository();
  return {
    expirations: new PrismaExpirationRepository(),
    captcha: new PrismaCaptchaRepository(),
    gateway: new HttpTelegramGateway(),
    token: env.TELEGRAM_BOT_TOKEN,
    now: new Date(),
    resolveChatTelegramId: async (chatId: string) => {
      const chat = await prisma.chat.findUnique({ where: { id: chatId } });
      return chat?.telegramChatId ?? undefined;
    },
    resolveBotToken: (tenantId: string) =>
      guardian.resolveBotTokenForTenant(
        tenantId,
        env.TELEGRAM_BOT_TOKEN,
        env.MANAGED_BOT_TOKEN_KEY,
      ),
  };
};

export const runExpirationJob = async (
  name: string,
  context: ExpirationContext,
): Promise<{ ok: boolean; summary?: unknown }> => {
  switch (name) {
    case "moderation.sanction.expire":
      return { ok: true, summary: await processSanctionExpirations(context) };
    case "captcha.challenge.expire":
      return { ok: true, summary: await processCaptchaExpirations(context) };
    case "warning.expire":
      return { ok: true, summary: await processWarningExpirations(context) };
    case "post.publish.due":
      return {
        ok: true,
        summary: await processScheduledPosts({
          posts: new PrismaScheduledPostRepository(),
          gateway: new HttpTelegramGateway(),
          resolveBotToken: context.resolveBotToken,
          now: context.now,
        }),
      };
    case "reminder.fire.due":
      return {
        ok: true,
        summary: await processReminders({
          productivity: new PrismaProductivityRepository(),
          gateway: new HttpTelegramGateway(),
          resolveBotToken: context.resolveBotToken,
          now: context.now,
        }),
      };
    case "rss.poll.due":
      return {
        ok: true,
        summary: await processFeeds({
          feeds: new PrismaFeedRepository(),
          gateway: new HttpTelegramGateway(),
          fetcher: defaultFeedFetcher,
          resolveBotToken: context.resolveBotToken,
        }),
      };
    case "webhook.deliver.due":
      return {
        ok: true,
        summary: await processWebhookDeliveries({
          webhooks: new PrismaWebhookRepository(),
          fetcher: defaultWebhookFetcher,
        }),
      };
    case "managedbot.expire": {
      const env = getRuntimeEnv();
      return {
        ok: true,
        summary: await processExpiredManagedBots({
          platform: new PrismaPlatformRepository(
            prisma,
            env.MANAGED_BOT_TOKEN_KEY,
          ),
          gateway: new HttpTelegramGateway(),
          parentToken: context.token,
          warnWithinMs: 3 * 24 * 60 * 60 * 1000,
          now: context.now,
        }),
      };
    }
    case "pets.tick": {
      const ajustes = new PrismaChatSettingRepository();
      const mascotas = new PrismaPetRepository();
      // Los dos que hacen falta para que el aviso de salud pueda salir por el
      // Ayudante: el ajuste dice si esta activo en ese grupo, y la cola es por
      // donde se le pide el trabajo.
      const chatSettings = ajustes;
      const solicitudesDelAyudante = new AyudanteSolicitudRepositoryPrisma();
      return {
        ok: true,
        summary: await procesarTickDeMascotas({
          mascotas,
          ajustesDeChat: (tenantId, chatId) =>
            ajustes.getValue(tenantId, chatId, PETS_SETTINGS_KEY),
          ahora: context.now,
          // Los dos proveedores del contexto del grupo. Hasta hoy no se pasaba
          // ninguno y catorce especies tenian el efecto declarado sin hacer
          // nada — la ficha prometia algo que no ocurria.
          especiesDelGrupo: async (tenantId, chatId) => {
            // El corral entero, que en un grupo son decenas de filas. Se pide
            // una vez por grupo y por barrido, no una por mascota.
            const todas = await mascotas.corral(tenantId, chatId, 1000);
            const cuenta: Record<string, number> = {};
            for (const otra of todas) {
              cuenta[otra.especie] = (cuenta[otra.especie] ?? 0) + 1;
            }
            return cuenta;
          },
          diasLimpiosDelGrupo: (tenantId, chatId) =>
            new PrismaModerationExtraRepository().diasSinSanciones(
              tenantId,
              chatId,
              context.now,
            ),
          // El corral en orden. Enciende al camaleon, que copia el bono del
          // bicho de al lado. Sale de la misma consulta que ya se hacia para
          // contar especies, asi que no es una peticion mas.
          corralDelGrupo: async (tenantId, chatId) => {
            const todas = await mascotas.corral(tenantId, chatId, 1000);
            return todas.map((otra) => otra.especie);
          },
          // Recien llegados que SE HAN QUEDADO: entraron en los ultimos
          // treinta dias y siguen dentro. Enciende al pollito.
          //
          // Lo de "se quedaron" es la parte que importa: contar a quien entro
          // y se fue premiaria justo el trasiego que un grupo no quiere, y
          // convertiria al pollito en una impresora cada vez que alguien hace
          // limpieza.
          novatosDelGrupo: async (_tenantId, chatId) => {
            const desde = new Date(
              context.now.getTime() - 30 * 24 * 60 * 60 * 1000,
            );
            return prisma.membership.count({
              where: { chatId, joinedAt: { gte: desde }, leftAt: null },
            });
          },
          // Los avisos de una mascota grave: el recordatorio y el obituario.
          //
          // Van al GRUPO y **no detras del ajuste `avisos`**, a diferencia de
          // las subidas. Ese ajuste calla el ruido de cuarenta bichos subiendo
          // de nivel de madrugada; esto no es ruido: sin el aviso, la factura y
          // el plazo son una encerrona. Y no puede inundar nada, porque solo
          // hay mascotas enfermas cuando alguien las ha declarado a mano.
          avisarDeSalud: async (aviso) => {
            if (!esEspecieId(aviso.especie)) {
              return;
            }
            const chat = await prisma.chat.findUnique({
              where: { id: aviso.chatId },
            });
            if (!chat?.telegramChatId) {
              return;
            }
            // Se nombra a la persona. Un aviso que dice "a alguien se le muere
            // el bicho" no avisa a nadie, y el dueño es justo quien tiene que
            // leerlo.
            const persona = await prisma.appUser
              .findFirst({
                where: { telegramUserId: aviso.usuario },
                select: { displayName: true, username: true },
              })
              .catch(() => null);
            // Si el Ayudante esta activo en este grupo, el aviso sale por el:
            // es el unico que puede ENLAZAR a quien no tiene `@alias`, y a esa
            // persona se le esta diciendo que su bicho se muere y que va a
            // pagar una factura. Un nombre en texto plano no le llega nunca.
            //
            // Si no lo esta, todo sigue exactamente igual que antes. Esto no
            // quita nada a ningun grupo: solo añade donde se puede.
            const conAyudante = await chatSettings
              .getValue(aviso.tenantId, aviso.chatId, "ayudante")
              .catch(() => undefined);

            const mencion = conAyudante
              ? `{{MENCION:${aviso.usuario}}}`
              : (persona?.displayName ??
                (persona?.username ? `@${persona.username}` : null) ??
                `id ${aviso.usuario}`);

            const texto = textoDeAvisoDeSalud({
              clase: aviso.clase,
              especie: aviso.especie,
              nombre: aviso.nombre,
              duenoMencion: mencion,
              motivo: aviso.motivo,
              coste: aviso.coste ?? 0,
              msQueQuedan: aviso.vence
                ? Math.max(0, aviso.vence.getTime() - context.now.getTime())
                : 0,
            });

            if (conAyudante) {
              await solicitudesDelAyudante.crear({
                tenantId: aviso.tenantId,
                tipo: "comunicacion.publicar_con_menciones",
                payload: { chatId: chat.telegramChatId.toString(), texto },
              });
              return;
            }

            await new HttpTelegramGateway().sendMessage({
              chatId: chat.telegramChatId,
              reply: { text: texto, parseMode: "HTML" },
              token: getRuntimeEnv().TELEGRAM_BOT_TOKEN,
            });
          },
          // El parte de las subidas de anoche. Llega ya agrupado por chat —un
          // mensaje por grupo, no uno por mascota— y el propio barrido lo deja
          // detras del ajuste `avisos`, que sale apagado.
          //
          // El `chatId` de una mascota es el cuid interno, no el de Telegram:
          // mandarlo tal cual no llegaria a ninguna parte. Por eso se resuelve
          // aqui, que es donde hay base de datos.
          anunciar: async (aviso) => {
            const texto = textoDeSubidasDelDia(
              aviso.subidas.flatMap((subida) =>
                esEspecieId(subida.especie)
                  ? [
                      {
                        especie: subida.especie,
                        nombre: subida.nombre,
                        nivel: subida.nivel,
                        evoluciona: subida.evoluciona,
                      },
                    ]
                  : [],
              ),
            );
            if (texto === null) {
              return;
            }
            const chat = await prisma.chat.findUnique({
              where: { id: aviso.chatId },
            });
            if (!chat?.telegramChatId) {
              return;
            }
            await new HttpTelegramGateway().sendMessage({
              chatId: chat.telegramChatId,
              reply: { text: texto, parseMode: "HTML" },
              token: getRuntimeEnv().TELEGRAM_BOT_TOKEN,
            });
          },
        }),
      };
    }
    case "economy.purge.tick": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      return {
        ok: true,
        summary: await processPurges({
          chatSetting: new PrismaChatSettingRepository(),
          economy: new PrismaEconomyRepository(),
          gateway: new HttpTelegramGateway(),
          nowMs: context.now.getTime(),
          random: () => Math.random(),
          resolveChatTelegramId: async (chatId: string) => {
            const chat = await prisma.chat.findUnique({
              where: { id: chatId },
            });
            return chat?.telegramChatId ?? undefined;
          },
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
          resolveNames: (ids) =>
            new PrismaFoundationRepository().findDisplayNamesByTelegramUserIds(
              ids,
            ),
        }),
      };
    }
    case "games.trivia.announce": {
      const env = getRuntimeEnv();
      return {
        ok: true,
        summary: await processTriviaAnnouncements({
          chatSetting: new PrismaChatSettingRepository(),
          gateway: new HttpTelegramGateway(),
          token: context.token,
          primaryBotUsername: env.TELEGRAM_BOT_USERNAME,
          miniAppName: env.TELEGRAM_MINIAPP_NAME,
          appUrlHttps: env.TELEGRAM_APP_URL.startsWith("https://"),
          nowMs: context.now.getTime(),
          resolveChatTelegramId: async (chatId: string) => {
            const chat = await prisma.chat.findUnique({
              where: { id: chatId },
            });
            return chat?.telegramChatId ?? undefined;
          },
          resolveTenantSlug: async (tenantId: string) => {
            const tenant = await prisma.tenant.findUnique({
              where: { id: tenantId },
            });
            return tenant?.slug ?? undefined;
          },
        }),
      };
    }
    case "community.recap.weekly": {
      const env = getRuntimeEnv();
      const activity = new PrismaChatActivityRepository();
      return {
        ok: true,
        summary: await processWeeklyRecap({
          chatSetting: new PrismaChatSettingRepository(),
          gateway: new HttpTelegramGateway(),
          ai: buildAiProviderFromEnv(env),
          resolveBotToken: context.resolveBotToken,
          nowMs: context.now.getTime(),
          listWeekEvents: (tenantId: string, chatId: string) =>
            activity.listRecent(tenantId, chatId, "message", 500),
          resolveChatTelegramId: async (chatId: string) => {
            const chat = await prisma.chat.findUnique({
              where: { id: chatId },
            });
            return chat?.telegramChatId ?? undefined;
          },
        }),
      };
    }
    case "guardian.session.expire": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      return {
        ok: true,
        summary: await processGuardianSessionExpirations({
          guardian,
          gateway: new HttpTelegramGateway(),
          sessionSecret: env.GUARDIAN_SESSION_SECRET,
          sessionSecretPrevious: env.GUARDIAN_SESSION_SECRET_PREVIOUS,
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
          now: context.now,
        }),
      };
    }
    case "community.introduction_sweep": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      const foundation = new PrismaFoundationRepository();
      const moderation = new PrismaModerationRepository();
      const moderationExtra = new PrismaModerationExtraRepository();
      return {
        ok: true,
        summary: await processIntroductionSweep({
          introductions: new PrismaIntroductionRepository(),
          gateway: new HttpTelegramGateway(),
          intocables: env.SUPERBOT_INTOCABLES_TELEGRAM_IDS,
          // La sala de STAFF de cada grupo es la que ya usa Guardian para sus
          // informes. Tener dos ajustes distintos para "donde avisa el bot al
          // equipo" garantizaba que uno de los dos acabara sin configurar.
          staffRoom: async (tenantId: string, chatId: string) => {
            const settings = await guardian.getSettings(tenantId, chatId);
            if (!settings) {
              return null;
            }
            // El grupo puede querer las fichas de presentación en su propio
            // tema. Si la lectura falla o no hay nada puesto, `staffThreadId`
            // se queda a null y todo sigue yendo al tema de Guardian: un
            // ajuste ilegible no puede mandar las fichas a otro sitio.
            const intro = parseIntroductionSettings(
              await new PrismaChatSettingRepository()
                .getValue(tenantId, chatId, INTRODUCTION_SETTINGS_KEY)
                .catch(() => undefined),
            );
            return {
              staffChatId: settings.staffChatId,
              staffThreadId: settings.staffThreadId,
              introductionThreadId: intro.staffThreadId,
            };
          },
          chatTitle: async (chatId: string) =>
            (await prisma.chat.findUnique({ where: { id: chatId } }))?.title ??
            null,
          introductionSettings: async (tenantId: string, chatId: string) =>
            parseIntroductionSettings(
              await new PrismaChatSettingRepository()
                .getValue(tenantId, chatId, INTRODUCTION_SETTINGS_KEY)
                .catch(() => undefined),
            ),
          // El aviso automatico al vencer el plazo. Se apoya en el mismo sistema
          // de warns que `/warn`, a proposito: un contador propio para las
          // presentaciones seria un historial paralelo que ningun admin mira.
          //
          // Desde 2026-08-13 el barrido SI escala: aviso periodico segun la
          // cadencia del grupo y, con `autoKickAtLimit`, expulsion al llegar
          // al limite. Lo que hizo legitimo expulsar desde un job — despues de
          // que el 3 de agosto uno se llevara por delante a tres admins — es
          // que ahora se comprueba `getChatMember` antes de cada aviso y del
          // kick: los admins salen del embudo, no del grupo.
          warns: {
            create: async (input) => {
              const creado = await moderation.createWarning({
                tenantId: input.tenantId,
                chatId: input.chatId,
                actorUserId: undefined,
                subjectTelegramUserId: input.subjectTelegramUserId,
                reason: input.reason,
              });
              return { recordId: creado.recordId };
            },
            countActive: (tenantId, chatId, subjectTelegramUserId) =>
              moderation.countActiveWarnings(
                tenantId,
                chatId,
                subjectTelegramUserId,
              ),
            limitFor: async (chatId) =>
              (await moderationExtra.getWarnPolicy(chatId)).warnLimit,
            revert: async (warningId) => {
              await moderationExtra.expireWarning(warningId);
            },
          },
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
          audit: (input) => foundation.recordAudit(input),
          now: context.now,
        }),
      };
    }
    case "guardian.media.retention_cleanup": {
      const env = getRuntimeEnv();
      return {
        ok: true,
        summary: await processGuardianMediaRetention({
          guardian: new PrismaGuardianRepository(),
          storage: createStorageDriverFromEnv(env),
          now: context.now,
        }),
      };
    }
    case "messages.media_fetch": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      const gateway = new HttpTelegramGateway();
      return {
        ok: true,
        summary: await processMessageMedia({
          messages: new PrismaMessageLogRepository(),
          storage: createStorageDriverFromEnv(env),
          downloadFile: (input: {
            fileId: string;
            token: string | undefined;
          }) => gateway.downloadFile(input),
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
        }),
      };
    }
    case "guardian.staff_message.retention_cleanup": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      return {
        ok: true,
        summary: await processGuardianStaffMessageRetention({
          guardian,
          gateway: new HttpTelegramGateway(),
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
          now: context.now,
        }),
      };
    }
    case "inbox.retention_cleanup": {
      const env = getRuntimeEnv();
      return {
        ok: true,
        summary: await processRetention({
          targets: [
            updateInboxTarget(
              new PrismaRetentionRepository(),
              env.UPDATE_INBOX_RETENTION_DAYS,
            ),
          ],
          now: context.now,
        }),
      };
    }
    case "data.retention_cleanup": {
      const env = getRuntimeEnv();
      const repo = new PrismaRetentionRepository();
      return {
        ok: true,
        summary: await processRetention({
          targets: [
            auditLogTarget(repo, env.AUDIT_LOG_RETENTION_DAYS),
            chatActivityTarget(repo, env.CHAT_ACTIVITY_RETENTION_DAYS),
          ],
          now: context.now,
        }),
      };
    }
    case "casino.duel.expire": {
      const env = getRuntimeEnv();
      const guardian = new PrismaGuardianRepository();
      return {
        ok: true,
        summary: await processStaleDuels({
          chips: new PrismaChipRepository(),
          gateway: new HttpTelegramGateway(),
          resolveBotToken: (tenantId: string) =>
            guardian.resolveBotTokenForTenant(
              tenantId,
              env.TELEGRAM_BOT_TOKEN,
              env.MANAGED_BOT_TOKEN_KEY,
            ),
          // Well above the ~3-5s a normal duel takes (2x sendDice + a 2.2s
          // animation delay), short enough opponents aren't locked out long.
          staleAfterMs: 5 * 60 * 1000,
          now: context.now,
        }),
      };
    }
    default:
      // Un nombre que llega hasta aqui es un job declarado en
      // `expirationJobNames` para el que nadie escribio el `case`. Devolver
      // `ok: false` no servia de nada: BullMQ solo marca fallo cuando se lanza,
      // asi que el job se completaba igual y el trabajo no se hacia nunca.
      throw new Error(`job de expiracion sin implementar: ${name}`);
  }
};

export const buildWorkerServer = async () => {
  const env = getRuntimeEnv();
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  // Internal server-to-server API, loopback-bound — no browser is a legitimate
  // caller, so disable CORS instead of reflecting any Origin.
  await app.register(cors, { origin: false });
  await app.register(helmet, { global: true });

  const RedisClient = IORedis as unknown as new (
    url: string,
    options?: { maxRetriesPerRequest?: null },
  ) => unknown;
  const redis = env.REDIS_URL
    ? new RedisClient(env.REDIS_URL, { maxRetriesPerRequest: null })
    : undefined;
  const queue = redis ? new Queue(queueName, { connection: redis }) : undefined;

  if (redis) {
    const worker = new Worker(
      queueName,
      async (job) => {
        app.log.info({ jobId: job.id, name: job.name }, "processing job");

        if ((expirationJobNames as readonly string[]).includes(job.name)) {
          const context = buildExpirationContext(env);
          const result = await runExpirationJob(job.name, context);
          app.log.info({ name: job.name, result }, "expiration job done");
          return result;
        }

        // Un nombre que no esta declarado NO puede contarse como hecho.
        //
        // Antes se devolvia `{ ok: true }` y BullMQ lo marcaba completado, asi
        // que un job renombrado seguia disparando para siempre sin hacer nada:
        // los repetibles viven en Redis con su nombre viejo y sobreviven al
        // despliegue que los renombro. Una sancion podia dejar de expirar en
        // silencio y no habia forma de enterarse.
        //
        // Lanzar lo deja en la cola de fallidos, con reintentos y visible.
        throw new Error(
          `job desconocido: ${job.name}. No esta en expirationJobNames; probablemente es un repetible obsoleto que quedo en Redis tras renombrarlo.`,
        );
      },
      { connection: redis, concurrency: env.WORKER_CONCURRENCY },
    );

    worker.on("failed", (job, error) => {
      // `err`, no `error`: este logger es el de Fastify, que solo trae
      // serializador para `err` — con `error` el objeto salía como `{}`.
      app.log.error({ jobId: job?.id, err: error }, "job failed");
    });

    if (queue) {
      // Limpieza de repetibles obsoletos, ANTES de registrar los de ahora.
      //
      // Un repetible vive en Redis, no en el codigo: si alguien renombra un job
      // o lo borra de la lista, el viejo sigue programado y disparando. Con el
      // arreglo de arriba eso ya no pasa desapercibido —falla y se ve— pero
      // seguiria llenando la cola de fallos cada minuto. Aqui se retiran.
      try {
        const declarados = new Set<string>(expirationJobNames);
        for (const repetible of await queue.getRepeatableJobs()) {
          if (declarados.has(repetible.name)) continue;
          await queue.removeRepeatableByKey(repetible.key);
          app.log.warn(
            { name: repetible.name },
            "retirado repetible obsoleto: ya no esta declarado en expirationJobNames",
          );
        }
      } catch (error) {
        // No fatal: si Redis no deja listar los repetibles, el arranque sigue.
        // Los obsoletos se veran igualmente como fallos, que es lo importante.
        app.log.warn({ err: error }, "no se pudo revisar los repetibles");
      }

      for (const name of expirationJobNames) {
        await queue.add(
          name,
          {},
          {
            repeat: { every: 60_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
            jobId: `repeat:${name}`,
          },
        );
      }
    }
  }

  app.get("/health", async () => ({
    ok: true,
    service: "worker",
    queue: queueName,
    redis: Boolean(redis),
    expirationJobs: expirationJobNames,
  }));

  app.post("/v1/jobs/enqueue", async (request) => {
    const body = request.body as {
      name?: string;
      payload?: Record<string, unknown>;
    };

    // Only known job names may be enqueued — otherwise this endpoint is an
    // arbitrary-job-injection / resource-exhaustion lever. The loopback binding
    // is the network control; this whitelist is the application-level one.
    if (
      !queue ||
      !body?.name ||
      !(expirationJobNames as readonly string[]).includes(body.name)
    ) {
      return { ok: false, enqueued: false };
    }

    const job = await queue.add(body.name, body.payload ?? {}, {
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return { ok: true, enqueued: true, jobId: job.id };
  });

  return app;
};
