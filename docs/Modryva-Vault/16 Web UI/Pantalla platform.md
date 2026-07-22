---
id: modryva-pantalla-platform
title: Pantalla platform
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/platform/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Pantalla plataforma
  - Mis bots
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla platform

## Qué es
Panel de la **plataforma de bots gestionados** (estilo GroupHelp): lista los bots hijos, permite ver su detalle y grupos, reactivarlos, escribir como un bot, y —según rol— crear promos, dar acceso directo (custombot) y generar códigos de IA. El acceso está gateado por `canSeePlatform(me)` (owner, cualquier rol, tener bots o slots libres, `page.tsx:88-92`); si no, estado `denied` (`page.tsx:172-183`).

Bloques principales:
- Lista de bots con estado (Activo/Pausado/Activando/Error/Revocado, `page.tsx:44-58`, `375-405`).
- Detalle de un bot (`openDetails`, `page.tsx:137-156`): control (abrir, añadir a grupo con `startgroup=true&admin=...`, reactivar) y "Grupos vistos" (`page.tsx:417-514`). Al owner cada grupo enlaza a `/config?sp=cfg_<chatId>&actas=<botUsername>` (`page.tsx:96-98`, `478-491`).
- "Escribir como bot" (solo owner, `page.tsx:516-555`).
- Códigos de IA: crear + listar (solo owner, `page.tsx:570-634`).
- Crear promo (`canManagePromos`, `page.tsx:636-684`) y dar acceso directo (`canGrantBots`, `page.tsx:686-726`).
- Promos recientes (`page.tsx:728-743`).

Roles: `promo_admin`, `bot_factory_admin`, más `isOwner` (`page.tsx:82-92`).

## Ruta y componentes
- Ruta Next real: `/platform` (`apps/web/app/platform/page.tsx`), client component (`page.tsx:1`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Caption`, `Empty`, `Field`, `Group`, `Row`, `SkeletonList` (`page.tsx:6-19`).

## Datos (API) — todos bajo `/v1/platform/*`
- `platformMe()` → `GET /v1/platform/me` (`api.ts:691`).
- `platformBotDetails` → `GET /v1/platform/bots/{username}` (`api.ts:701`).
- `sendPlatformBotMessage` → `POST /v1/platform/bots/{username}/send-message` (`api.ts:709`).
- `reactivateBot` → `POST /v1/platform/mybots/reactivate` (`api.ts:694`).
- `platformPromos` / `createPlatformPromo` → `GET`/`POST /v1/platform/promos` (`api.ts:717`, `727`).
- `grantCustomBot` → `POST /v1/platform/grants/custombot` (`api.ts:737`).
- `platformAiCodes` / `createPlatformAiCode` → `GET`/`POST /v1/platform/ai-codes` (`api.ts:754`, `757`).
- Ver `[[Controller platform]]`.

## Estado
Implementada y cableada. El `x-platform-act-as-bot-username` (deep link `actas=`) permite operar un bot hijo desde el panel del padre — lo adjunta `apiFetch` cuando hay act-as (`lib/api.ts:85-87`).

## Preguntas abiertas
- La lógica de `managedBotSlots` (cuántos bots puede crear un usuario) se decide en la API; aquí solo se muestra (`page.tsx:359`, `366-373`).
- `reactivateBot` puede fallar con razones (`no-slot`, `not-suspended`, `webhook-failed`, `webhook-url-not-https`, `page.tsx:37-42`); el detalle del backoff/webhook es `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Controller platform]], [[Pantalla config]], [[Pantalla ai-pack]], [[Pantalla premium]], [[API Overview]]
