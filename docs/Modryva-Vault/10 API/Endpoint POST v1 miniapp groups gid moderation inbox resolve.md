---
id: endpoint-post-v1-miniapp-groups-gid-moderation-inbox-resolve
title: Endpoint POST v1 miniapp groups gid moderation inbox resolve
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/moderation-inbox.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/moderation/inbox/:kind/:id/resolve]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid moderation inbox resolve

`resolve()` en [[Controller moderation-inbox]] (`apps/api/src/miniapp/moderation-inbox.controller.ts:102`). Resuelve un item de la bandeja.

## Entrada

- Path: `:gid`, `:kind` (`report`/`quarantine`/`appeal`/`ticket`), `:id`.
- Body: `{ action, assigneeTelegramId? }`; `resolveBodySchema` (`:34`), `action` ∈ `approve`/`reject`/`close`/`assign`.
- Cabecera `Authorization: tma <initData>`.

## Salida

`{ ok: true }` (`:145`). Efecto según `kind` (`dispatchResolve`, `:148`): report → `resolveReport(status)`; quarantine → `resolveQuarantineItem`; appeal → `resolveAppeal`; ticket → `assign` o `setStatus`. Registra auditoría `miniapp.moderation.inbox.resolve` (`:130`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Errores: 400 `invalid-kind`, 400 `invalid-body`, 400 `resolve-failed` (item fuera de la red autorizada), 400 `missing-assignee`/`invalid-assignee` en `assign` de ticket (`:186`–`:193`). El resolve de quarantine/appeal valida que el chat resuelto esté en `allowedChatIds`.

## Consumidor

`resolveModerationInboxItem(gid, kind, id, body)` en `apps/web/lib/api-moderation.ts:52`.

## Relaciones

- **Pertenece a**: [[Controller moderation-inbox]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla moderation]] (`resolveModerationInboxItem`).
- **Consume**: [[Modelo Report]], [[Modelo Ticket]], [[Modelo Appeal]], [[Modelo AuditLog]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid moderation inbox]], [[API Map]].
