---
id: controller-owner-network
title: Controller owner-network
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/owner-network.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappOwnerNetworkController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller owner-network

`MiniappOwnerNetworkController` (`apps/api/src/miniapp/owner-network.controller.ts:117`). La **consola de red del owner**: política global (welcome/rules/logs/membership), roles de grupo y rutas de eventos, con **snapshot + rollback** para deshacer una aplicación masiva. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:116`).

Instancia d1, federation, foundation, group-protection, owner-network y welcome (`:118`–`:123`); inyecta [[Servicio admin]] (`:125`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/network` | Estado de la red: config, chats (alineados/desalineados), roles, rutas, último snapshot. | InitDataGuard + admin | `:129` |
| POST | `groups/:gid/network` | Crea red y une el chat. | InitDataGuard + admin | `:136` |
| POST | `groups/:gid/network/join` | Une el chat a una red por `{ networkId }`. | InitDataGuard + admin | `:170` |
| DELETE | `groups/:gid/network` | El chat abandona la red (limpia membership gates). | InitDataGuard + admin | `:194` |
| POST | `groups/:gid/network/rename` | Renombra la red. | InitDataGuard + **network-admin** | `:213` |
| PUT | `groups/:gid/network/settings` | Aplica política global a todos los chats (snapshot antes). Valida `networkSettingsSchema`. | InitDataGuard + **network-admin** | `:233` |
| POST | `groups/:gid/network/rollback` | Restaura el último snapshot. | InitDataGuard + **network-admin** | `:264` |
| PUT | `groups/:gid/network/routing` | Reemplaza roles de grupo + rutas de eventos (snapshot antes). Valida `routingSchema`. | InitDataGuard + **network-admin** | `:282` |

`networkSettingsSchema` (`:47`): `logTelegramChatId`, `welcomeMode` (`per_group`/`global`), textos, `rulesMode`, `membershipMode` (`off`/`require_all`). `routingSchema` (`:59`) valida roles (`OWNER_NETWORK_GROUP_ROLES`) y rutas (`OWNER_NETWORK_ROUTE_EVENT_KINDS`); `normalizeRoutingInput` (`:726`) rechaza chats fuera de la red y rutas duplicadas.

## Aplicar / deshacer

`applyConfig` (`:318`) propaga logs, welcome/rules (si modo `global`) y membership gates (`require_all` = cada chat exige a los demás) a **todos** los chats de la red. `snapshotNetwork` (`:373`) captura config+roles+rutas+estado por chat antes de cada apply; `restoreSnapshot` (`:437`) lo revierte. La `view` (`:493`) marca cada chat `aligned`/`misaligned` comparando su estado real con la política.

## Autorización

`authorize` (`:641`) = admin del grupo; `requireNetworkAdmin` (`:657`) = owner **o** `isFedAdmin` (403 `not-network-admin`, 400 `not-in-network`). La `view` sólo devuelve chats/roles/rutas/snapshot a network-admins (`:509`).

## Modelos que toca

[[Modelo Federation]], [[Modelo OwnerNetworkConfig]], [[Modelo OwnerNetworkGroupRole]], [[Modelo OwnerNetworkRoute]], [[Modelo OwnerNetworkSnapshot]], [[Modelo WelcomeConfig]], [[Modelo GroupProtection]] (membership gates), [[Modelo D1LogConfig]], [[Modelo AuditLog]].

## Consumido desde apps/web

`getOwnerNetworkStatus` (`apps/web/lib/api.ts:384`), `createOwnerNetwork` (`:387`), `joinOwnerNetwork` (`:393`), `leaveOwnerNetwork` (`:399`), `renameOwnerNetwork` (`:404`), `updateOwnerNetworkSettings` (`:410`), `updateOwnerNetworkRouting` (`:419`), `rollbackOwnerNetwork` (`:431`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla network]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo OwnerNetworkConfig]], [[Modelo OwnerNetworkSnapshot]], [[Modelo Federation]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller federation]], [[Controller network-analytics]], [[Controller automation]], [[Controller backup]], [[API Map]].
