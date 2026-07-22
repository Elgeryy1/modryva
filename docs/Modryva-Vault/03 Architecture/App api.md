---
id: app-api
title: App api
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - apps/api/src/index.ts
  - apps/api/src/server.ts
  - apps/api/src/app.module.ts
  - apps/api/src/miniapp/init-data.guard.ts
tags:
  - modryva
  - architecture
  - api
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# App api

`@superbot/api` es la **API interna** que sirve el backend de la Mini App y el bootstrap. App
**NestJS sobre Fastify**, no expuesta públicamente de forma directa: el navegador la alcanza siempre a
través del proxy de [[App web]] (`API_INTERNAL_URL=http://api:3001`).

## Responsabilidad

Exponer los endpoints `v1/*` que consume la Mini App (config del grupo, moderación, federación, casino,
juegos, gamificación, backups, red de owner, panel de usuario, etc.) y el bootstrap/verificación de
`initData`. Ver [[API Map]].

## Puntos de entrada

- `apps/api/src/index.ts` — `buildApiServer()` y `app.listen(API_PORT ?? 3001)`.
- `apps/api/src/server.ts` — `buildApiServer()`:
  - App Nest con `FastifyAdapter`.
  - **CORS** con allowlist (`TELEGRAM_APP_URL` + `localhost:3003`), **helmet**.
  - **Rate limiter global** (`createRateLimiter capacity 600, refill 300/s`) como techo; responde `429`
    (`server.ts:42-50`). El throttle por-usuario real lo hace `InitDataGuard` sobre las búsquedas de token.

## Controllers

`apps/api/src/app.module.ts` (`ApiAppModule`) registra ~21 controllers:

- Raíz: `BootstrapController`, `HealthController`, `InitDataController`, `DashboardController`,
  `PlatformController`, `ObservabilityController`, `GamesController`, `CasinoController`.
- `miniapp/*` (14): `config`, `lists`, `federation`, `owner-network`, `moderation-inbox`, `wizard`,
  `network-risk`, `network-analytics`, `gamification`, `user-panel`, `automation`, `backup`,
  `entitlement`, `ai-pack`.
- Providers: `InitDataGuard`, `MiniappAdminService`, `GamesService`, `CasinoService`.

Endpoints documentados en `docs/ARCHITECTURE.md`: `GET /v1/bootstrap`, `GET /v1/modules`,
`POST /v1/init-data/verify`. La validación de `initData` usa HMAC según el contrato de Telegram Web Apps
(`apps/api/src/telegram-init-data.ts`, con tests).

## Cómo se despliega

Servicio `api` en `docker-compose.yml` (`SERVICE=@superbot/api`, puerto `3001`). Depende de `postgres` y
`redis` sanos. No publica origen HTTPS propio: todo tráfico entra por el proxy de la web.

## Qué consume / produce

- **Consume**: `@superbot/data` (Postgres), `@superbot/shared`, cabeceras `authorization` (initData) y
  `x-bot-username` reenviadas por la web.
- **Produce**: JSON para la Mini App; lecturas/escrituras de config, casino, gamificación, etc.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package data]], [[Package shared]], [[Package domain]]
- Utilizado por: [[App web]]
- Relacionado con: [[Arquitectura General]], [[API Map]], [[Guard InitData]]
