---
id: endpoint-get-v1-miniapp-groups-gid-moderation-inbox
title: Endpoint GET v1 miniapp groups gid moderation inbox
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/moderation-inbox.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/moderation/inbox]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid moderation inbox

`list()` en [[Controller moderation-inbox]] (`apps/api/src/miniapp/moderation-inbox.controller.ts:70`). Bandeja agregada cross-chat de reports, cuarentena, apelaciones y tickets.

## Entrada

- Path: `:gid`. Query opcional: `chatId`, `kind` (`report`/`quarantine`/`appeal`/`ticket`), `status`.
- Cabecera `Authorization: tma <initData>`.

## Salida

`{ items, chatIds }` (`:99`). Cada `item`: `{ id, kind, chatId, subjectTelegramId?, reason?, priority?, status, createdAt }` (`InboxItem`, `:39`). `chatIds` es la lista de chats de la red que se han inspeccionado. Los items se ordenan por `createdAt` desc.

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Alcance de chats vía `networkChatIds` (federación o sólo el propio chat). Error: 400 `invalid-kind` si el filtro `kind` no es válido (`:79`).

## Consumidor

`getModerationInbox(gid, filters)` en `apps/web/lib/api-moderation.ts:44`.

## Relaciones

- **Pertenece a**: [[Controller moderation-inbox]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data` (D1, moderation-extra, tickets, federation).
- **Utilizado por**: [[Pantalla moderation]] (`getModerationInbox`).
- **Consume**: [[Modelo Report]], [[Modelo Ticket]], [[Modelo Appeal]], [[Modelo QuarantineItem]].
- **Relacionado con**: [[Endpoint POST v1 miniapp groups gid moderation inbox resolve]], [[API Map]].
