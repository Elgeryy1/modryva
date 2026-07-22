---
id: arquitectura-general
title: Arquitectura General
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - package.json
  - pnpm-workspace.yaml
  - turbo.json
  - tsconfig.base.json
  - docker-compose.yml
  - docs/ARCHITECTURE.md
tags:
  - modryva
  - architecture
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Arquitectura General

Modryva es un **monolito modular** en TypeScript (paquete raíz `superbot`, `package.json:2`) organizado
como un **monorepo pnpm + Turborepo**. La tesis de diseño (ver `docs/ARCHITECTURE.md`) es mantener
límites claros: procesos desplegables (`apps/*`), librerías transversales (`packages/*`) y features de
dominio (`modules/*`), todo compartiendo un único esquema de datos.

## Piezas del monorepo

`pnpm-workspace.yaml:1` declara tres grupos de workspaces: `apps/*`, `packages/*`, `modules/*`.

- **4 apps** (procesos): [[App bot]], [[App api]], [[App web]], [[App worker]].
- **5 paquetes** compartidos: [[Package domain]], [[Package telegram]], [[Package data]],
  [[Package shared]], [[Package auth]].
- **9 módulos** de dominio (`modules/`, verificado por `ls`): `ai`, `automation`, `community`, `core`,
  `files`, `games`, `payments`, `security`, `support`. Contienen lógica pura (una feature por fichero con
  su test hermano); el bot los importa como `@superbot/module-*`. Ver [[Modules Map]].

> Nota de conteo: `docs/ARCHITECTURE.md` y algún texto de UI mencionan "10"/"11" módulos; el directorio
> `modules/` tiene exactamente **9** subcarpetas a fecha 2026-07-12. Registrado en [[Open Questions]].

## Herramientas de build

- **pnpm 11.7** (`package.json:5`, `engines.node >=24`). Config especial para Windows/UNC en
  `pnpm-workspace.yaml` (`nodeLinker: hoisted`, `packageImportMethod: copy`, `storeDir` en `${TEMP}`).
- **Turborepo** (`turbo.json`): pipeline `dev` (persistente, sin caché), `build` (`dependsOn ["^build"]`,
  salidas `.next/**` y `dist/**`), `typecheck`, `test` (`dependsOn ["^build"]`).
- **Alias TypeScript** en `tsconfig.base.json:4-19`: `@superbot/<paquete>` y `@superbot/module-<name>`
  resuelven a `src/index.ts`. Compilador estricto: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `module/moduleResolution: NodeNext`.
- Lint/format con **Biome** + `scripts/lint-copy.mjs`; tests con **Vitest** (`package.json:19-22`).

## Topología en ejecución

De `docker-compose.yml` (servicios y puertos):

- `postgres` (Postgres 16, `5433:5432`) — persistencia única de todo el stack vía Prisma.
- `redis` (Redis 7, `6379`) — cola BullMQ para el worker.
- `bot` (`3002`, `BOT_MODE=polling`) — [[App bot]], corre como `@ModryvaBot` por long-polling.
- `api` (`3001`) — [[App api]], backend de la Mini App (no expuesto público directamente).
- `worker` (`3004`) — [[App worker]], jobs periódicos.
- `web` (`3003`) — [[App web]], **única superficie pública** (tras túnel Cloudflare).
- `cloudflared` + `urlsync` (perfil `tunnel`) / `cloudflared-named` (perfil `tunnel-named`) — HTTPS público.

Cada servicio se construye con el mismo `Dockerfile` multi-servicio (arg `SERVICE=@superbot/<app>`); solo
`@superbot/web` ejecuta `next build` dentro de la imagen (`Dockerfile:32`).

## Flujo bot ↔ api ↔ web ↔ worker ↔ datos

El navegador (Telegram Mini App) **solo** habla con la web; la web hace de proxy hacia api y bot por la
red interna de Docker (`apps/web/app/api/[...path]/route.ts`, `apps/web/app/telegram/webhook/[botUsername]/route.ts`).
Telegram entrega updates al bot por webhook (a través de la web) o el bot los saca por polling.

```mermaid
flowchart LR
  TG["Telegram Bot API"] -->|webhook o getUpdates| BOT["App bot :3002<br/>Nest/Fastify (polling)"]
  User["Usuario / Mini App"] -->|HTTPS| CF["Cloudflare Tunnel"]
  CF --> WEB["App web :3003<br/>Next.js 15"]
  WEB -->|/telegram/webhook/:bot| BOT
  WEB -->|/api/v1/*| API["App api :3001<br/>Nest/Fastify"]
  BOT -->|@superbot/data| PG[("PostgreSQL :5433")]
  API -->|@superbot/data| PG
  WORKER["App worker :3004<br/>BullMQ"] --> PG
  WORKER -->|colas repetidas| REDIS[("Redis :6379")]
  BOT -->|@superbot/telegram| TG
  WORKER -->|@superbot/telegram| TG
  BOT --> MODS["modules/* (lógica pura)"]
```

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package domain]], [[Package data]], [[Package shared]], [[Package telegram]], [[Package auth]]
- Utilizado por: [[App bot]], [[App api]], [[App web]], [[App worker]]
- Relacionado con: [[Monorepo Layout]], [[Bot Pipeline]], [[Infrastructure Map]], [[Modules Map]], [[Repository Inventory]]
