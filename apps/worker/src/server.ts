import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  PrismaCaptchaRepository,
  PrismaChatActivityRepository,
  PrismaChatSettingRepository,
  PrismaChipRepository,
  PrismaExpirationRepository,
  PrismaFeedRepository,
  PrismaGuardianRepository,
  PrismaPlatformRepository,
  PrismaProductivityRepository,
  PrismaScheduledPostRepository,
  PrismaWebhookRepository,
  prisma,
} from "@superbot/data";
import { buildAiProviderFromEnv } from "@superbot/module-ai";
import { createStorageDriverFromEnv } from "@superbot/module-files";
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
} from "./guardian-processor.js";
import { processWeeklyRecap } from "./recap-processor.js";
import { type FeedFetcher, processFeeds } from "./rss-processor.js";
import { processTriviaAnnouncements } from "./trivia-announce-processor.js";
import {
  processWebhookDeliveries,
  type WebhookFetcher,
} from "./webhook-processor.js";

const queueName = "superbot-jobs";

const defaultWebhookFetcher: WebhookFetcher = async (url, init) => {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
};

const defaultFeedFetcher: FeedFetcher = async (url) => {
  const response = await fetch(url, {
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
  "casino.duel.expire",
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
      return { ok: false };
  }
};

export const buildWorkerServer = async () => {
  const env = getRuntimeEnv();
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  await app.register(cors, { origin: true });
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

        return { ok: true, processedAt: new Date().toISOString() };
      },
      { connection: redis, concurrency: env.WORKER_CONCURRENCY },
    );

    worker.on("failed", (job, error) => {
      app.log.error({ jobId: job?.id, error }, "job failed");
    });

    if (queue) {
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

    if (!queue || !body?.name) {
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
