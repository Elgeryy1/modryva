---
id: modryva-integration-telegram-mini-apps
title: Integración Telegram Mini Apps
type: integration
domain: integration
status: implemented
maturity: stable
source:
  - apps/api/src/telegram-init-data.ts
  - apps/api/src/miniapp/init-data.guard.ts
  - apps/web
tags:
  - modryva
  - integration
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración Telegram Mini Apps

## Qué es
Las Mini Apps de Telegram: web ([[App web]], Next.js) embebida en Telegram que autentica al usuario con
`initData` firmado por Telegram.

## Punto de contacto
- Verificación HMAC del `initData` en `apps/api/src/telegram-init-data.ts` + [[Guard InitData]]
  (todas las rutas `v1/miniapp/*` y casino/games).
- El frontend adjunta `Authorization: tma <initData>` (`apps/web/lib/api.ts`, proxy same-origin `/api`).
- Deep-links `startapp` (grupo) y `web_app` (privado) enrutados en `apps/web/app/page.tsx`.

## Datos
Identidad de usuario + parámetro de grupo (`?sp=`) para bots hijos. `INITDATA_MAX_AGE_SECONDS` limita la
antigüedad.

## Fallos
initData caducado → 401 ("cierra y reabre la Mini App"). Ver [[API Overview]].

## Relaciones
- Pertenece a: [[Integrations Map]]
- Depende de: [[Package auth]]
- Utilizado por: [[API Overview]], [[Product Map]]
- Relacionado con: [[Guard InitData]], [[Modryva Hub Map]]
