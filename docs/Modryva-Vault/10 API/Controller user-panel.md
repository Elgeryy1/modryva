---
id: controller-user-panel
title: Controller user-panel
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/user-panel.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappUserPanelController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller user-panel

`MiniappUserPanelController` (`apps/api/src/miniapp/user-panel.controller.ts:54`). Ficha 360º de un usuario dentro de la red: warnings, reports, notas internas, rol interno y perfil de riesgo. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:53`).

Instancia federation, moderation-extra, internal-role y risk (`:55`–`:58`); inyecta [[Servicio admin]] (`:60`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/users/:telegramUserId` | Perfil: `warnings`, `reports`, `notes`, `internalRole`, `risk`, `networkChats`, `canManageRole`. | InitDataGuard + admin | `:64` |
| PUT | `groups/:gid/users/:telegramUserId/role` | Fija el rol interno (`{ role }` de `INTERNAL_ROLES`). | InitDataGuard + **owner de red** | `:148` |
| POST | `groups/:gid/users/:telegramUserId/notes` | Añade una nota interna (`{ note }`). | InitDataGuard + admin (en red) | `:185` |

`telegramUserIdSchema` (`:30`) exige `^\d+$`. `canManageRole` = es owner de la federación (`:133`). Nota importante del código: el **rol interno sólo controla el acceso al panel de la Mini App; nunca sustituye a ser admin real de Telegram** para acciones como banear o mutear (`:100`).

## Autorización

`authorize` (`:223`) = admin del grupo. `setRole` exige `fed.ownerTelegramId === auth.userId` (403 `not-network-owner`, 400 `not-in-network`). `addNote` sólo exige que el chat esté en una federación (`:202`).

## Modelos que toca

[[Modelo Warning]] (moderation-extra), [[Modelo Report]], [[Modelo InternalRole]] (rol + notas), [[Modelo RiskProfile]], [[Modelo Federation]], [[Modelo FederationChat]].

## Consumido desde apps/web

`getUserPanelProfile` (`apps/web/lib/api-user-panel.ts:48`), `setUserPanelRole` (`:53`), `addUserPanelNote` (`:63`). Los roles internos válidos se exportan como `INTERNAL_ROLES` (`api-user-panel.ts:3`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla users]] vía `apps/web/lib/api-user-panel.ts`.
- **Consume**: [[Modelo InternalRole]], [[Modelo RiskProfile]], [[Modelo Report]], [[Modelo Federation]].
- **Relacionado con**: [[Controller moderation-inbox]], [[Controller network-risk]], [[Platform Roles y RBAC]], [[API Map]].
