import "reflect-metadata";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { createRateLimiter, getRuntimeEnv } from "@superbot/shared";

import { BotAppModule } from "./app.module.js";

const WEBHOOK_PATH = /^\/telegram\/webhook\/([^/]+)/u;

export const buildBotServer = async (): Promise<NestFastifyApplication> => {
  const env = getRuntimeEnv();
  const adapter = new FastifyAdapter({
    logger: { level: env.LOG_LEVEL },
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    BotAppModule,
    adapter,
    {
      logger: ["error", "warn", "log"],
    },
  );

  // The browser reaches the bot only through the Next.js proxy; Telegram
  // webhooks are server-to-server (no Origin). Allow the app origin + no-Origin
  // only — never `origin: true` behind a public tunnel.
  const allowedOrigins = new Set(
    [env.TELEGRAM_APP_URL, "http://localhost:3003"].filter(Boolean),
  );
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
    credentials: false,
  });
  await app.register(helmet, { global: true });

  // Rate limiting (no external dep). All bot traffic arrives from the proxy's
  // IP, so the meaningful key on the webhook is the managed bot username — one
  // noisy tenant can't flood the pipeline. A generous global bucket backstops
  // runaway. Returns 429 before the handler runs.
  const perBot = createRateLimiter({ capacity: 40, refillPerSec: 20 });
  const global = createRateLimiter({ capacity: 600, refillPerSec: 300 });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook("onRequest", (request, reply, done) => {
    const path = (request.url.split("?")[0] ?? "").toLowerCase();
    const match = WEBHOOK_PATH.exec(path);
    const overLimit = match
      ? !perBot.tryConsume(`wh:${match[1]}`)
      : !global.tryConsume(`ip:${request.ip}`);
    if (overLimit) {
      reply.code(429).send({ ok: false, error: "rate-limited" });
      return;
    }
    done();
  });

  return app;
};
