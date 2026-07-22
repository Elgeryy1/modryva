---
id: app-web
title: App web
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - apps/web/next.config.ts
  - apps/web/package.json
  - apps/web/app/api/[...path]/route.ts
  - apps/web/app/telegram/webhook/[botUsername]/route.ts
  - docker-compose.yml
  - Dockerfile
tags:
  - modryva
  - architecture
  - web
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# App web

`@superbot/web` es la **Mini App / panel** en **Next.js 15 (App Router) + React 19** (`apps/web/package.json`).
Es la **única superficie pública** del stack: se sirve tras el túnel Cloudflare y hace de **proxy** hacia
[[App api]] y [[App bot]] por la red interna de Docker.

## Responsabilidad

1. Renderizar la Mini App de Telegram y el panel de configuración de grupo.
2. Ser el borde público: reenvía peticiones del navegador a los servicios internos sin exponerlos.

## Pantallas (App Router)

Directorios en `apps/web/app/`: `/` (router `startapp`), `/casino`, `/games`, `/platform`, `/help`,
`/terms`, `/privacy`, y `/config/*` con ~21 secciones (`moderation`, `automations`, `federation`,
`blocklist`, `filters`, `gamification`, `analytics`, `risk`, `users`, `network`, `premium`, `ai-pack`,
`backup`, `onboarding`, `schedule-rules`, `rituals`, `quiet`, `recap`, `wizard`, `[section]` dinámica).
Componentes de casino en `apps/web/components/casino/*`. Ver [[Product Map]].

## Proxies (borde público → interno)

- `apps/web/app/api/[...path]/route.ts` — reenvía **solo** `/api/v1/*` a `API_INTERNAL_URL`. Allowlist
  mínima de cabeceras (`authorization`, `content-type`, `x-bot-username`, `x-platform-act-as-bot-username`);
  nunca host/cookie/origin. Devuelve `503` si falta la URL, `502` si el upstream no responde.
- `apps/web/app/telegram/webhook/[botUsername]/route.ts` — reenvía el webhook de Telegram a
  `BOT_INTERNAL_URL` (`http://bot:3002`), validando el username (`/^[A-Za-z0-9_]{1,64}$/`) y propagando
  `x-telegram-bot-api-secret-token`. Así los **managed bots** hijos entran por webhook a través de la web.

## Configuración de build

`apps/web/next.config.ts`: `typedRoutes: true`; **sin** `output: standalone` (la imagen envía
`node_modules` completo y sirve con `next start`); **sin** `transpilePackages` (solo importa *tipos* de
`@superbot/shared`, borrados en build, e inlinea metadatos en `lib/config-meta.ts`).

## Cómo se despliega

Servicio `web` en `docker-compose.yml` (`SERVICE=@superbot/web`, puerto `3003`). Es el único `SERVICE`
que ejecuta `pnpm --filter @superbot/web build` dentro del `Dockerfile` (`Dockerfile:32`). El CMD arranca
`next start`.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[App api]], [[App bot]], [[Package shared]]
- Utilizado por: usuarios finales (Telegram Mini App)
- Relacionado con: [[Arquitectura General]], [[Infrastructure Map]], [[Runtime URL]], [[Product Map]]
