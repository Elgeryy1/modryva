---
id: endpoint-post-v1-miniapp-groups-gid-automations
title: Endpoint POST v1 miniapp groups gid automations
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/automation.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/automations]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid automations

`create()` en [[Controller automation]] (`apps/api/src/miniapp/automation.controller.ts:169`). Crea una automatización (disparador → condición → acción) en la red del grupo.

## Entrada

- Path: `:gid`. Body validado con `createSchema` (`:90`): `{ name, trigger, condition, action, scope? }`. `scope: "network"` deja `chatId=null` (aplica a toda la red); si no, se ancla al chat.
- Cabecera `Authorization: tma <initData>`.

## Salida

La automatización creada en forma de API (`toApi`, `:124`): `{ id, chatId, name, trigger, condition, action, enabled, createdAt, updatedAt }`.

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Errores: 400 `invalid-body` (schema Zod, `:176`), 400 `not-in-network` si el chat no pertenece a una federación (`:181`).

## Consumidor

`createAutomation(...)` en `apps/web/lib/api-automation.ts:45`. Lista con `getAutomations` (`:40`), actualiza/borra/toggle con `updateAutomation`/`removeAutomation`/`toggleAutomation`.

## Relaciones

- **Pertenece a**: [[Controller automation]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla automations]] (`createAutomation`).
- **Consume**: [[Modelo Automation]], [[Modelo Federation]].
- **Relacionado con**: [[Controller owner-network]], [[API Map]].
