---
id: app-bot
title: App bot
type: architecture
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/index.ts
  - apps/bot/src/server.ts
  - apps/bot/src/app.module.ts
  - apps/bot/src/telegram-webhook.controller.ts
  - apps/bot/src/health.controller.ts
  - docker-compose.yml
tags:
  - modryva
  - architecture
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# App bot

`@superbot/bot` es el proceso que **ingiere los updates de Telegram** y los procesa. Es una app
**NestJS sobre Fastify** que expone un webhook y, en despliegue actual, corre por **long-polling**.

## Responsabilidad

Recibir cada update de Telegram (por `POST /telegram/webhook/:botUsername` o por `getUpdates`) y pasarlo
por la pipeline central [[Bot Update Service]] (`processWebhook`). Todo lo demás (moderación, IA, juegos,
comunidad, pagos…) se resuelve dentro de esa pipeline reusando los [[Package data]] repos y el gateway de
[[Package telegram]].

## Puntos de entrada

- `apps/bot/src/index.ts` — arranca el servidor con `buildBotServer()`, escucha en `BOT_PORT` (3002 por
  defecto) y, si `BOT_MODE === "polling"`, lanza `startPolling(...)` en modo fire-and-forget (ver [[Poller]]).
- `apps/bot/src/server.ts` — `buildBotServer()`:
  - Crea la app Nest con `FastifyAdapter`.
  - **CORS** con allowlist estricta (`TELEGRAM_APP_URL` + `localhost:3003`; nunca `origin: true`), y **helmet**.
  - **Rate limiting** propio sin dependencias (`createRateLimiter` de [[Package shared]]): cubo por bot
    (`capacity 40`, `refill 20/s`, clave = username del webhook) y cubo global (`600`/`300/s`); responde
    `429` antes de ejecutar el handler (`server.ts:44-58`).

## Controllers y módulos

`apps/bot/src/app.module.ts` (`BotAppModule`) registra:

- **Controllers**: [[Controller TelegramWebhook]] y [[Controller Health]].
- **~45 providers** por token `Symbol` (ver `apps/bot/src/tokens.ts`): un `Prisma*Repository` de
  [[Package data]] por cada dominio (moderación, antiflood, captcha, notas, reputación, IA, pagos,
  plataforma, chat-activity, chat-setting…), más `HttpTelegramGateway`, `HttpQuoteRenderer`,
  `HttpSpamCheckProvider`, `buildAiProviderFromEnv` y `InMemoryFloodCounter`.
- Todos se inyectan en el constructor de [[Bot Update Service]].

`HealthController` reporta `{ ok, service: "bot", runtime: "nestjs-fastify", modules }` listando los
manifiestos de `@superbot/module-core` y `@superbot/module-security`.

## Cómo se despliega

Servicio `bot` en `docker-compose.yml`: imagen del `Dockerfile` con `SERVICE=@superbot/bot`,
`BOT_MODE=polling`, `restart: unless-stopped`, puerto `3002`. Monta el volumen `tunnel_state` en
`/state:ro` para leer la URL viva de la Mini App (ver [[Runtime URL]]). Corre como `@ModryvaBot`.

## Qué consume / produce

- **Consume**: updates de Telegram; `@superbot/data` (Postgres); `@superbot/module-*`.
- **Produce**: mensajes/acciones a Telegram vía `@superbot/telegram`; filas de auditoría, moderación,
  actividad, etc. en Postgres.

## Relaciones

- Pertenece a: [[Architecture Map]], [[Bot Core Map]]
- Depende de: [[Package data]], [[Package telegram]], [[Package domain]], [[Package shared]], [[Package auth]]
- Consume: [[Bot Update Service]], [[Poller]]
- Relacionado con: [[Arquitectura General]], [[Bot Pipeline]], [[Controller TelegramWebhook]], [[App web]]
