---
id: app-worker
title: App worker
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - apps/worker/src/index.ts
  - apps/worker/src/server.ts
  - docker-compose.yml
tags:
  - modryva
  - architecture
  - worker
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# App worker

`@superbot/worker` es el proceso de **trabajos en segundo plano**: **Fastify + BullMQ + IORedis**. Corre
los jobs periódicos que no deben bloquear la pipeline del bot (expiraciones, recaps, RSS, webhooks).

## Responsabilidad

Consumir la cola `superbot-jobs` (BullMQ sobre Redis) y ejecutar procesadores contra Postgres y la Bot API
de Telegram. También se auto-programa a sí mismo: registra jobs repetidos cada 60 s al arrancar.

## Puntos de entrada

- `apps/worker/src/index.ts` — `buildWorkerServer()` y `server.listen(WORKER_PORT ?? 3004)`.
- `apps/worker/src/server.ts` — `buildWorkerServer()`:
  - Fastify con CORS/helmet.
  - Si hay `REDIS_URL`, crea `Queue` + `Worker` (`concurrency = env.WORKER_CONCURRENCY`, 2 por defecto).
  - Registra **10 jobs repetidos** (`repeat.every: 60_000`) — `expirationJobNames` (`server.ts:55-66`):
    `moderation.sanction.expire`, `captcha.challenge.expire`, `warning.expire`, `post.publish.due`,
    `reminder.fire.due`, `rss.poll.due`, `webhook.deliver.due`, `managedbot.expire`,
    `games.trivia.announce`, `community.recap.weekly`.
  - `runExpirationJob(name, ctx)` despacha cada uno a su procesador.

## Procesadores (`apps/worker/src/*`)

- `expiration-processor.ts` — expira sanciones, captchas, warnings; publica posts programados; dispara
  recordatorios; procesa RSS; expira managed bots. Ver [[Job expiration]].
- `recap-processor.ts` — recap semanal de comunidad con IA opcional (`buildAiProviderFromEnv`). Ver [[Job recap.weekly]].
- `rss-processor.ts` — feeds RSS → posts. Ver [[Job rss]].
- `trivia-announce-processor.ts` — anuncio de trivia comunitaria. Ver [[Job trivia-announce]].
- `webhook-processor.ts` — entrega de webhooks salientes. Ver [[Job webhook]].

## Endpoints

- `GET /health` — `{ ok, service: "worker", queue, redis, expirationJobs }`.
- `POST /v1/jobs/enqueue` — encola un job puntual `{ name, payload }`.

## Cómo se despliega

Servicio `worker` en `docker-compose.yml` (`SERVICE=@superbot/worker`, puerto `3004`,
`WORKER_CONCURRENCY=2`). Depende de `postgres` y `redis` sanos.

## Qué consume / produce

- **Consume**: cola Redis `superbot-jobs`; repos Prisma de [[Package data]].
- **Produce**: mensajes a Telegram vía `HttpTelegramGateway`; mutaciones en Postgres (expiraciones, posts).

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package data]], [[Package telegram]], [[Package shared]]
- Consume: Redis (BullMQ), PostgreSQL
- Relacionado con: [[Arquitectura General]], [[Infrastructure Map]], [[Bot Core Map]]
