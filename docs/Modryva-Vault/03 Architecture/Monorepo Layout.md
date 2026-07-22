---
id: monorepo-layout
title: Monorepo Layout
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - package.json
tags:
  - modryva
  - architecture
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Monorepo Layout

Mapa de carpetas del repo (raíz `Z:\proyectos_hacen_bulto_en_CV\ultrabot`, paquete `superbot`). Los tres
grupos de workspaces (`pnpm-workspace.yaml`) son `apps/*`, `packages/*`, `modules/*`.

## Árbol

```
superbot/
├─ apps/                 # procesos desplegables (4)
│  ├─ api/               # @superbot/api  → [[App api]]   (Nest/Fastify, :3001)
│  ├─ bot/               # @superbot/bot  → [[App bot]]   (Nest/Fastify, :3002, polling)
│  ├─ web/               # @superbot/web  → [[App web]]   (Next.js 15, :3003, público)
│  └─ worker/            # @superbot/worker → [[App worker]] (BullMQ, :3004)
├─ packages/             # librerías compartidas (5)
│  ├─ auth/              # @superbot/auth     → [[Package auth]]     (RBAC + policy)
│  ├─ data/              # @superbot/data     → [[Package data]]     (Prisma + repos + schema)
│  ├─ domain/            # @superbot/domain   → [[Package domain]]   (contratos puros)
│  ├─ shared/            # @superbot/shared   → [[Package shared]]   (env, logger, rate-limit)
│  └─ telegram/          # @superbot/telegram → [[Package telegram]] (gateway + normalize)
├─ modules/              # features de dominio (9) → [[Modules Map]]
│  ├─ ai/ automation/ community/ core/ files/
│  └─ games/ payments/ security/ support/
├─ scripts/              # run.mjs, lint-copy.mjs, check-production-env.mjs
├─ docs/                 # ARCHITECTURE.md, DEVELOPMENT.md, runbooks, este Vault
├─ Dockerfile           # imagen multi-servicio (arg SERVICE)
├─ docker-compose.yml   # postgres, redis, bot, api, worker, web, cloudflared
├─ turbo.json           # pipeline dev/build/typecheck/test
├─ tsconfig.base.json   # alias @superbot/* + compilador estricto
└─ pnpm-workspace.yaml  # workspaces + ajustes Windows/UNC
```

## Alias de import

`tsconfig.base.json:4-19` mapea cada paquete y módulo a su `src/index.ts`: `@superbot/shared`,
`@superbot/domain`, `@superbot/telegram`, `@superbot/auth`, `@superbot/data`, y `@superbot/module-<name>`
para los 9 módulos (`core`, `security`, `community`, `support`, `automation`, `files`, `games`, `ai`,
`payments`).

## Dependencias entre capas

`apps/*` dependen de `packages/*` y `modules/*`. `modules/*` dependen de `packages/*` (sobre todo
`domain` y `data`). `packages/*` dependen entre sí de forma acíclica: `domain` es la base; `data`,
`telegram` y `auth` dependen de `domain`; `shared` es independiente.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Relacionado con: [[Arquitectura General]], [[Repository Inventory]], [[Modules Map]], [[Database Map]]
