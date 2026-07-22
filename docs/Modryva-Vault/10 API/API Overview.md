---
id: api-overview
title: API Overview
type: moc
domain: api
status: implemented
maturity: stable
source: [apps/api/src/app.module.ts, apps/api/src/server.ts, apps/api/src/index.ts]
tags: [modryva, moc, api]
aliases: [API, Modryva API]
created: 2026-07-12
updated: 2026-07-12
---

# API Overview

HUB del dominio **API** de Modryva: un servicio **NestJS sobre Fastify** (`apps/api`) que sirve el backend de la **Mini App de Telegram** (config de grupos, juegos, casino, red de grupos, plataforma de bots) y algunos endpoints operativos (health/metrics).

## Cómo está montada

- **Framework**: NestJS con `FastifyAdapter` (`apps/api/src/server.ts:14`). Arranca en `apps/api/src/index.ts` escuchando en `API_PORT` (por defecto `3001`, `index.ts:7`).
- **Módulo raíz**: `ApiAppModule` (`apps/api/src/app.module.ts`) declara **22 controllers** y **4 providers** (`InitDataGuard`, `MiniappAdminService`, `GamesService`, `CasinoService`).
- **Sin prefijo global**: los controllers definen su ruta completa (`v1/...`, `health`). El navegador nunca llama directo: la web usa el proxy `/api` de Next.js, que reenvía al contenedor api (ver `apps/web/lib/api.ts:7`).
- **Seguridad de transporte** (`server.ts`):
  - **CORS** restringido: solo `TELEGRAM_APP_URL` y `http://localhost:3003`; nunca `origin: true` (`server.ts:28-36`).
  - **Helmet** global (`server.ts:37`).
  - **Rate limit global** de respaldo: `capacity: 600, refillPerSec: 300` por IP; devuelve `429 { error: "rate-limited" }` (`server.ts:42-50`). Es un techo, no per-usuario (la api está detrás del proxy, `req.ip` es el proxy).

## Autenticación por initData

Casi todos los endpoints de negocio están protegidos por **[[Guard InitData]]** (`@UseGuards(InitDataGuard)`). El guard exige la cabecera `Authorization: tma <initData>`, verifica el HMAC de Telegram contra el token del bot correcto y adjunta `request.miniapp` (userId, user, startParam, botUsername, botToken). Ver [[Guard InitData]] para el detalle multi-tenant (`X-Bot-Username`, `X-Platform-Act-As-Bot-Username`).

Excepciones sin guard:
- **[[Controller health]]** y **[[Controller observability]]**: sondas y métricas, públicas.
- **[[Controller bootstrap]]**: manifiestos de módulos, público.
- **[[Controller init-data]]**: verifica initData manualmente (no usa el guard).

## Controllers (22)

| Controller | Prefijo `@Controller` | Auth | Nota |
|---|---|---|---|
| `HealthController` | *(raíz)* | pública | [[Controller health]] |
| `ObservabilityController` | *(raíz)* | pública | [[Controller observability]] |
| `BootstrapController` | `v1` | pública | [[Controller bootstrap]] |
| `InitDataController` | `v1/init-data` | verificación manual | [[Controller init-data]] |
| `DashboardController` | `v1/dashboard` | InitDataGuard | [[Controller dashboard]] |
| `PlatformController` | `v1/platform` | InitDataGuard (+roles) | [[Controller platform]] |
| `GamesController` | `v1/games` | InitDataGuard | [[Controller games]] |
| `CasinoController` | `v1/casino` | InitDataGuard | [[Controller casino]] |
| `MiniappConfigController` | `v1/miniapp` | InitDataGuard | [[Controller config]] |
| `MiniappListsController` | `v1/miniapp` | InitDataGuard | [[Controller lists]] |
| `MiniappFederationController` | `v1/miniapp` | InitDataGuard | [[Controller federation]] |
| `MiniappOwnerNetworkController` | `v1/miniapp` | InitDataGuard (+network-admin) | [[Controller owner-network]] |
| `MiniappModerationInboxController` | `v1/miniapp` | InitDataGuard | [[Controller moderation-inbox]] |
| `MiniappWizardController` | `v1/miniapp` | InitDataGuard | [[Controller wizard]] |
| `MiniappNetworkRiskController` | `v1/miniapp` | InitDataGuard (+network-admin) | [[Controller network-risk]] |
| `MiniappNetworkAnalyticsController` | `v1/miniapp` | InitDataGuard (+network-admin) | [[Controller network-analytics]] |
| `MiniappGamificationController` | `v1/miniapp` | InitDataGuard | [[Controller gamification]] |
| `MiniappUserPanelController` | `v1/miniapp` | InitDataGuard | [[Controller user-panel]] |
| `MiniappAutomationController` | `v1/miniapp` | InitDataGuard | [[Controller automation]] |
| `MiniappBackupController` | `v1/miniapp` | InitDataGuard | [[Controller backup]] |
| `MiniappEntitlementController` | `v1/miniapp` | InitDataGuard (+owner/network-admin) | [[Controller entitlement]] |
| `AiPackController` | `v1/miniapp` | InitDataGuard | [[Controller ai-pack]] |

> Nota: nueve controllers comparten el prefijo `v1/miniapp`. NestJS lo permite mientras las rutas concretas no colisionen (cada uno registra `groups/:gid/...` distintos).

## Servicios (providers)

- [[Servicio admin]] — `MiniappAdminService`: autorización viva contra Telegram (`assertGroupAdmin`) + `resolveChat` (tenant del bot).
- [[Servicio games]] — `GamesService`: sesiones de arcade con anti-cheat, trivia diaria, jefe cooperativo.
- [[Servicio casino]] — `CasinoService`: casino provably-fair de fichas.
- [[Servicio dashboard]] — `PrismaDashboardCountsProvider`: conteos del panel por tenant.

## Ver también

- [[API Map]] — mapa de contenidos (MOC) del dominio API.
- [[Guard InitData]] — el guard de autenticación.

## Relaciones

- **Pertenece a**: dominio API (raíz).
- **Depende de**: [[Guard InitData]], `@superbot/data` (Prisma), `@superbot/shared` (env/rate-limit), `@superbot/telegram` (gateway HTTP).
- **Utilizado por**: [[Pantalla Mini App]] vía `apps/web/lib/api.ts` (proxy `/api`).
- **Relacionado con**: [[API Map]].
