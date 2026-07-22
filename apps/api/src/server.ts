import "reflect-metadata";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { createRateLimiter, getRuntimeEnv } from "@superbot/shared";
import { ApiAppModule } from "./app.module.js";

export const buildApiServer = async (): Promise<NestFastifyApplication> => {
  const env = getRuntimeEnv();
  const adapter = new FastifyAdapter({
    logger: { level: env.LOG_LEVEL },
    // Guardian Verification submits camera media as base64 inside a JSON body,
    // which can approach GUARDIAN_MAX_UPLOAD_MB of raw bytes (base64 inflates
    // ~33%, and guardian-verify.service allows headroom on top). Fastify's 1 MB
    // default would reject valid uploads with HTTP 413 before the app-level
    // size check ever runs, so size the transport limit to match the app limit.
    bodyLimit: env.GUARDIAN_MAX_UPLOAD_MB * 2 * 1024 * 1024,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiAppModule,
    adapter,
    {
      logger: ["error", "warn", "log"],
    },
  );

  // Same-origin by design: the browser reaches the api only through the Next.js
  // /api proxy. Allow just the web origin (+ its own origin / server-to-server
  // calls with no Origin header). Never `origin: true` behind a public tunnel.
  const allowedOrigins = new Set(
    [env.TELEGRAM_APP_URL, "http://localhost:3003"].filter(Boolean),
  );
  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, !origin || allowedOrigins.has(origin));
    },
    credentials: false,
  });
  await app.register(helmet, { global: true });

  // A generous global backstop against runaway request volume, shared across
  // ALL Mini App traffic — the api sits behind the Next.js proxy
  // (apps/web/app/api/[...path]/route.ts), so req.ip is always that proxy's
  // IP, never a real client. Per-user fairness lives downstream instead,
  // keyed on the initData-verified Telegram user id once that identity is
  // known: see InitDataGuard.perUser and GuardianSessionGuard.perUser. Routes
  // with no verified identity at all (health, bootstrap, init-data/verify)
  // rely on this global bucket alone.
  const global = createRateLimiter({ capacity: 600, refillPerSec: 300 });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook("onRequest", (request, reply, done) => {
    if (!global.tryConsume(`ip:${request.ip}`)) {
      reply.code(429).send({ error: "rate-limited" });
      return;
    }
    done();
  });

  return app;
};
