---
id: package-shared
title: Package shared
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - packages/shared/src/index.ts
  - packages/shared/src/env.ts
  - packages/shared/src/rate-limit.ts
tags:
  - modryva
  - architecture
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Package shared

`@superbot/shared` agrupa **utilidades transversales**: entorno, logging, rate limiting y contratos de la
Mini App. No tiene lógica de dominio; lo usan las 4 apps.

## Qué exporta

`packages/shared/src/index.ts`:

- `env.ts` — **`getRuntimeEnv()`** y el tipo **`RuntimeEnv`**: un esquema **zod** que valida y da defaults
  a todas las variables (`TELEGRAM_BOT_USERNAME` def. `superbot_bot`, `TELEGRAM_MINIAPP_NAME`,
  `WORKER_CONCURRENCY` def. 2, `LOG_LEVEL`, tokens, URLs…). Es el único parser de `process.env`.
- `rate-limit.ts` — **`createRateLimiter({ capacity, refillPerSec })`**: token bucket sin dependencias,
  usado por los `onRequest` hooks de [[App bot]] y [[App api]] para devolver `429`.
- `logger.ts` — logging (pino).
- `miniapp-contracts.ts`, `startapp.ts` — contratos y parseo de payloads `startapp` de la Mini App.
- `dashboard.ts`, `games-config.ts`, `observability.ts` — tipos/metadata compartidos con la web y la api.

## Quién lo usa

- [[App bot]] / [[App api]] / [[App worker]] — `getRuntimeEnv`, `createRateLimiter`.
- [[App web]] — **solo tipos** (borrados en build; ver `next.config.ts`, sin `transpilePackages`).

## Relaciones

- Pertenece a: [[Architecture Map]]
- Utilizado por: [[App bot]], [[App api]], [[App worker]], [[App web]]
- Relacionado con: [[Arquitectura General]], [[Env TELEGRAM_BOT_TOKEN]]
