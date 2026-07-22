---
id: endpoint-post-v1-miniapp-session
title: Endpoint POST v1 miniapp session
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/config.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/session]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp session

`session()` en [[Controller config]] (`apps/api/src/miniapp/config.controller.ts:91`). Primera llamada de la Mini App: resuelve **qué grupo y qué bot** sirven la sesión.

## Entrada

- Cabecera `Authorization: tma <initData>` ([[Guard InitData]]).
- Body opcional `{ startParam?: string }`. Prefiere el `start_param` firmado del initData; sólo usa el body cuando falta (bots hijos abren la Mini App con `?sp=` en la URL, sin `start_param` firmado) (`:98`–`:103`).

## Salida

- Sin grupo (o `decoded.kind` no es `config`/`onboarding`): `{ ok, group: null, bot: { username, name, template, isPrimary } }` (`:112`).
- Con grupo: `{ ok, group: { telegramChatId, title, botIsAdmin }, bot: {...} }` (`:130`). `botIsAdmin` es informativo (onboarding desactiva propósitos de moderación si el bot sólo es miembro).

## Auth y errores

`@UseGuards(InitDataGuard)`; con grupo llama `assertGroupAdmin(groupId, userId, bot)` — 403 si el usuario no es admin vivo del grupo en Telegram. El groupId sólo **selecciona** el grupo; la autorización la hace `assertGroupAdmin` ([[Servicio admin]]).

## Consumidor

`postSession(startParam?)` en `apps/web/lib/api.ts:128` (`POST /v1/miniapp/session`).

## Relaciones

- **Pertenece a**: [[Controller config]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]] (`assertGroupAdmin`, `resolveChat`, `botIdentity`, `botDisplayName`, `isBotAdmin`).
- **Utilizado por**: [[Pantalla Mini App]] (`postSession`).
- **Relacionado con**: [[Bot Scoping]], [[API Map]].
