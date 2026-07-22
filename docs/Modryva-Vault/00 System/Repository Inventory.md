---
id: system-repository-inventory
title: Repository Inventory
type: moc
domain: system
status: implemented
maturity: stable
source:
  - package.json
  - pnpm-workspace.yaml
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - system
  - inventory
  - moc
created: 2026-07-12
updated: 2026-07-12
---

# Repository Inventory

Inventario **verificado** del monorepo de Modryva (nombre interno del paquete raíz: `superbot`).
Todo lo de esta nota se obtuvo inspeccionando el repositorio real (no es una suposición). Las cifras
son un recuento a fecha `2026-07-12`; pueden variar al evolucionar el código — ver [[Vault Health Report]]
y [[Source Coverage]] para el estado de la documentación.

> Regla del Vault: cada afirmación técnica se apoya en evidencia. Cuando algo no se puede verificar se
> marca `unknown` y se registra en [[Open Questions]]. Ver [[Conventions]].

## Resumen de escala

| Métrica | Valor (verificado) |
|---|---|
| Apps (`apps/`) | 4 — `api`, `bot`, `web`, `worker` |
| Paquetes (`packages/`) | 5 — `auth`, `data`, `domain`, `shared`, `telegram` |
| Módulos (`modules/`) | 10 — `ai`, `automation`, `community`, `core`, `files`, `games`, `payments`, `security`, `support` |
| Modelos Prisma | **127** modelos + **11** enums |
| Controllers NestJS (api) | ~24 (`@Controller`) |
| Handlers de comando de bot (`handle*Command`) | **82** símbolos únicos |
| Procesadores del worker | 5 (`expiration`, `recap`, `rss`, `trivia-announce`, `webhook`) |
| Pantallas web (`app/**/page.tsx`) | 28 |
| Ficheros de test (`*.test.ts`) | **497** |
| Variables de entorno (`process.env.*`) | 23 |

## Gestor de paquetes y build

- **pnpm workspaces** (`pnpm-workspace.yaml`, `pnpm-lock.yaml`). **`pnpm` NO está en el PATH** en el
  entorno del usuario → usar los binarios de `node_modules` directamente (ver [[Local Development Setup]]).
- **Turborepo** (`turbo.json`) y **Biome** (`biome.json`) para lint/format (Biome 2.5.1).
- **Vitest** (`vitest.config.ts`) para tests.
- **Docker** (`Dockerfile` multi-servicio + `docker-compose.yml`). Ver [[Docker Compose Stack]].
- TypeScript estricto: `tsconfig.base.json` con **`exactOptionalPropertyTypes: true`** (ver
  [[Riesgo Build web más estricto que typecheck local]]).

## Apps

- [[App api]] — API NestJS + Fastify (`@superbot/api`). Sirve la Mini App y el panel.
- [[App bot]] — worker del bot de Telegram (`@superbot/bot`), long-polling como `@ModryvaBot`.
- [[App web]] — Next.js 15 (`@superbot/web`), Mini App / panel web.
- [[App worker]] — procesos en segundo plano (`@superbot/worker`): jobs, colas, RSS, recaps.

## Paquetes compartidos

- [[Package domain]] — `@superbot/domain`, lógica de dominio pura / contratos.
- [[Package telegram]] — `@superbot/telegram`, gateway hacia la Bot API de Telegram.
- [[Package data]] — `@superbot/data`, Prisma + repositorios (incluye `schema.prisma`).
- [[Package shared]] — `@superbot/shared`, contratos compartidos (Mini App, startapp, etc.).
- [[Package auth]] — `@superbot/auth`, verificación de initData / autenticación.

## Módulos de dominio (`modules/`)

Recuento de ficheros fuente (excluye `*.test.ts`):

| Módulo | Paquete | Ficheros src | Tests | Nota |
|---|---|---|---|---|
| `community` | `@superbot/module-community` | 139 | 138 | [[Módulo community]] |
| `security` | `@superbot/module-security` | 124 | 121 | [[Módulo security]] |
| `support` | `@superbot/module-support` | 79 | 78 | [[Módulo support]] |
| `games` | `@superbot/module-games` | 72 | 71 | [[Módulo games]] |
| `automation` | `@superbot/module-automation` | 33 | 32 | [[Módulo automation]] |
| `ai` | `@superbot/module-ai` | 9 | 8 | [[Módulo ai]] |
| `core` | `@superbot/module-core` | 3 | 1 | [[Módulo core]] |
| `files` | `@superbot/module-files` | 2 | 1 | [[Módulo files]] |
| `payments` | `@superbot/module-payments` | 2 | 1 | [[Módulo payments]] |

> Patrón observado: `community` y `security` contienen **muchísimos ficheros pequeños de lógica pura**
> (una "feature" por fichero, con su test hermano). No todos están cableados a un comando/handler — ver
> [[Wiring y banco de ideas]] y [[Riesgo Features de lógica pura sin cablear]].

## API — Controllers verificados

Raíz de rutas `v1/...` (todas tras `InitDataGuard` salvo salud/bootstrap):

- `v1` [[Controller bootstrap]] · `v1/dashboard` [[Controller dashboard]] · `v1/casino` [[Controller casino]]
- `v1/games` [[Controller games]] · `v1/init-data` [[Controller init-data]] · `v1/platform` [[Controller platform]]
- `v1/miniapp/*` (14 controllers): `ai-pack`, `automation`, `backup`, `config`, `entitlement`, `federation`,
  `gamification`, `lists`, `moderation-inbox`, `network-analytics`, `network-risk`, `owner-network`,
  `user-panel`, `wizard`. Ver [[API Map]].
- `health` [[Controller health]] · `observability` [[Controller observability]].

## Datos — dominios de modelos (muestra de los 127)

Agrupación temática (ver [[Database Map]] para el desglose completo):

- **Plataforma/multi-bot**: `Tenant`, `ManagedBot`, `PlatformRoleAssignment`, `PlatformUserBan`, `PromoCode`,
  `PromoRedemption`, `Entitlement`. Ver [[Modryva Hub Map]].
- **Identidad/RBAC**: `AppUser`, `Chat`, `Membership`, `Role`, `Permission`, `RoleBinding`, `Approval`.
- **Moderación**: `ModerationCase`, `Sanction`, `Warning`, `Report`, `Evidence`, `Appeal`, `SpamProfile`,
  `Antiflood*`, `Antiraid*`, `CaptchaConfig`, `Blocklist*`, `WarnPolicyConfig`. Ver [[Security Map]].
- **Comunidad**: `ChatSetting`, `CustomCommand`, `Filter`, `Poll`, `Reminder`, `Giveaway`, `ActivityDaily`,
  `UserActivity`, `WelcomeConfig`, `CoopMissionState`, `GratitudePoint`.
- **IA**: `AiConversation`, `AiMessage`, `AiUsage`, `AiMemory`, `AiAccessCode`, `AiChatAccess`,
  `AiUserAccess`, `AiSubscription`.
- **Juegos/economía**: `GameSession`, `GameScore`, `EconomyWallet` (+ casino: `ChipWallet`/`ChipLedger`/
  `CasinoBet`/`CasinoDuel` viven en el módulo games, ver [[Casino Map]]).
- **Owner Network** (federación de dueño): 15+ modelos `OwnerNetwork*`.
- **Infra/operación**: `UpdateInbox`, `CallbackInbox`, `IdempotencyKey`, `JobOutbox`, `AuditLog`,
  `SecurityAlert`, `Backup`, `Webhook`, `WebhookDelivery`.

## Worker — procesadores

- [[Job recap.weekly]] — recap semanal de comunidad (con IA opcional).
- [[Job expiration]] — expiración de sanciones/estados.
- [[Job rss]] — feeds RSS → posts.
- [[Job trivia-announce]] — anuncio de trivia comunitaria.
- [[Job webhook]] — entrega de webhooks salientes (managed bots).

## Web — pantallas (28)

Raíces: `/` (router startapp), `/casino`, `/games`, `/platform`, `/help`, `/terms`, `/privacy`, y
`/config/*` (21 secciones: `moderation`, `automations`, `federation`, `blocklist`, `filters`,
`gamification`, `analytics`, `risk`, `users`, `network`, `premium`, `ai-pack`, `backup`, `onboarding`,
`schedule-rules`, `rituals`, `quiet`, `recap`, `wizard`, `[section]` dinámica). Ver [[Product Map]].

## Documentación existente en `docs/`

Fuentes de verdad ya escritas por el equipo (a citar, no a duplicar):
`ARCHITECTURE.md`, `COMMANDS.md`, `DEVELOPMENT.md`, `PROGRESS.md`, `WIRING-HANDOFF.md`,
`PLAN-800-IDEAS.md`, `PLAN_REDISENO_TOTAL_MODRYVA.md`, `redesign-master-plan.md`, `casino-roadmap.md`,
`miniapps-runbook.md`, `mini-app-deploy.md`, `stable-tunnel-runbook.md`, `postgres-volume-migration.md`,
`BOTFATHER.md`, `BEST_BOT_IDEAS.md`. Ver [[References Map]] y [[Roadmap Map]].

## Entorno / despliegue

- Stack Docker desplegado con Docker Compose (Postgres, Redis y los servicios de la app).
- Servicios compose: `postgres`, `redis`, `bot`, `api`, `worker`, `web`, `cloudflared-named`.
- El bot corre por **long-polling** (`@ModryvaBot`); los managed bots hijos por **webhook** vía túnel
  Cloudflare con nombre. Ver [[Infrastructure Map]].

## Relaciones

- Pertenece a: [[Vault Manifest]]
- Relacionado con: [[Generation Plan]], [[Source Coverage]], [[Undocumented Sources]], [[Vault Health Report]]
- Produce: la base para todos los MOC — [[Modryva Home]]
