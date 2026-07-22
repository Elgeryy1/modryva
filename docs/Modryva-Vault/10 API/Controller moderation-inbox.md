---
id: controller-moderation-inbox
title: Controller moderation-inbox
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/moderation-inbox.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappModerationInboxController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller moderation-inbox

`MiniappModerationInboxController` (`apps/api/src/miniapp/moderation-inbox.controller.ts:59`). **Bandeja de moderación cross-chat**: agrega reports, cuarentena pendiente, apelaciones abiertas y tickets abiertos de todos los chats de la red del grupo (o sólo del propio chat si no hay red). Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:57`).

Instancia `PrismaD1Repository`, `PrismaFederationRepository`, `PrismaFoundationRepository`, `PrismaModerationExtraRepository` y `PrismaTicketRepository` (`:60`–`:64`); inyecta [[Servicio admin]] (`:66`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/moderation/inbox` | Lista items de toda la red; filtros query `chatId`, `kind`, `status`. Devuelve `{ items, chatIds }`. | InitDataGuard + admin | `:70` |
| POST | `groups/:gid/moderation/inbox/:kind/:id/resolve` | Resuelve un item (`{ action, assigneeTelegramId? }`); audita `miniapp.moderation.inbox.resolve`. | InitDataGuard + admin | `:102` |

`InboxKind` = `report`, `quarantine`, `appeal`, `ticket` (`:28`). `ResolveAction` = `approve`, `reject`, `close`, `assign` (`:31`). El mapeo report→estado está en `reportStatusFor` (`:319`); para quarantine/appeal el resolve **valida que el chat resuelto pertenezca a la red autorizada** (`allowedChatIds.includes(...)`, `:168`/`:181`); `assign` de ticket exige `assigneeTelegramId` (`:186`).

## Autorización y alcance

`authorize` (`:296`) = admin del grupo. `networkChatIds` (`:282`) resuelve la lista de chats de la federación (o `[ownChatId]` sin red). Ver y resolver comparten el mismo gate — el rol de admin ya está verificado en vivo contra Telegram por [[Servicio admin]].

## Modelos que toca

[[Modelo Report]] (moderation-extra), [[Modelo QuarantineItem]] (d1), [[Modelo Appeal]] (d1), [[Modelo Ticket]], [[Modelo Federation]], [[Modelo AuditLog]].

## Consumido desde apps/web

`getModerationInbox` (`apps/web/lib/api-moderation.ts:44`), `resolveModerationInboxItem` (`:52`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla moderation]] vía `apps/web/lib/api-moderation.ts`.
- **Consume**: [[Modelo Report]], [[Modelo Ticket]], [[Modelo Appeal]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller user-panel]], [[Controller owner-network]], [[Endpoint GET v1 miniapp groups gid moderation inbox]], [[Endpoint POST v1 miniapp groups gid moderation inbox resolve]], [[API Map]].
