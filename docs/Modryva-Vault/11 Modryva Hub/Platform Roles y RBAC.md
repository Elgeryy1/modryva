---
id: platform-roles-rbac
title: Platform Roles y RBAC
type: feature
domain: platform
status: implemented
maturity: beta
source:
  - apps/api/src/platform.controller.ts
  - packages/data/src/platform-repository.ts
  - apps/web/app/platform/page.tsx
  - packages/shared/src/env.ts
tags: [modryva, feature, platform]
aliases: [RBAC, Roles de plataforma]
created: 2026-07-12
updated: 2026-07-12
---

# Platform Roles y RBAC

Control de acceso del Hub. Combina **tres fuentes** de autoridad: el owner de entorno, los roles en BD
([[Modelo PlatformRoleAssignment]], valores en [[Enum PlatformRole]]) y una lista de admins de entorno.

## Fuentes de autoridad

1. **Owner de entorno:** `SUPERBOT_OWNER_TELEGRAM_ID` (`packages/shared/src/env.ts:85`). `isOwner` es true
   para este id o para quien tenga el rol `platform_owner` (`apps/api/src/platform.controller.ts:586`).
2. **Roles en BD:** `PlatformRoleAssignment` (telegramUserId + role + revokedAt). `hasRole`
   (`platform-repository.ts:417`) cuenta asignaciones no revocadas; `grantRole`/`revokeRole` (`:440`,`:467`).
3. **Admins de entorno:** `SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS` (`env.ts:86`). A estos ids,
   `effectiveRoles` (`platform.controller.ts:594`) les añade `promo_admin`, `bot_factory_admin`, `auditor`
   (`configuredPlatformAdminRoles`, `:49`) — sin escribir nada en BD.

## Roles y capacidades (según guards de [[Controller platform]])

| Rol | Puede | Comprobado por |
|---|---|---|
| `platform_owner` | Todo: `roles`, `ai-codes`, `send-message`, ver todos los bots, "act as" | `requireOwner`, `isOwner` |
| `promo_admin` | Crear/listar/revocar promos | `requireAccess(["promo_admin", ...])` |
| `bot_factory_admin` | Conceder slots directos (`grants/custombot`) | `requireAccess(["bot_factory_admin"])` |
| `support_admin` | *(rol declarado; sin endpoint dedicado encontrado)* | — |
| `auditor` | Listar promos (solo lectura) | `requireAccess(["promo_admin","auditor"])` |

> `support_admin` existe en el enum y en el parser de `/platform_admin` pero no se halló un endpoint que lo
> exija de forma exclusiva. Ver [[Open Questions]].

## Guards internos

- `requireOwner(req)` (`platform.controller.ts:470`) → 403 `platform-owner-required`.
- `requireAccess(req, allowed)` (`:452`) → owner o rol permitido; 403 `platform-access-denied`.
- `requireBotReadAccess(req, username)` (`:479`) → owner o dueño del bot; 403 `bot-access-denied`.

El "act as" de owner también se valida en el guard (`canPlatformActAs`) — ver [[Bot Scoping]].

## Gestión de roles

- **Web:** `POST /v1/platform/roles` (`action: grant|revoke`), solo owner (`:428`).
- **Bot:** `/platform_admin add|remove <user> <rol>` y `/platform_admin list`
  (parseo en `modules/core/src/platform.ts:230`; ejecución en `apps/bot/src/bot-update.service.ts`, audita
  `platform.role.granted` / `platform.role.revoked`).

## Gating en la Mini App

`apps/web/app/platform/page.tsx` decide qué formularios se muestran:
- `canManagePromos` = owner o `promo_admin` (`:82`).
- `canGrantBots` = owner o `bot_factory_admin` (`:85`).
- `canSeePlatform` = owner, o tener roles, o tener bots, o `managedBotSlots > 0` (`:88`).

## Relaciones

- Pertenece a: [[Modryva Hub Overview]]
- Depende de: [[Modelo PlatformRoleAssignment]], [[Enum PlatformRole]]
- Utilizado por: [[Controller platform]], [[Pantalla platform]]
- Relacionado con: [[Bot Scoping]], [[Platform User Ban]], [[Modryva Hub Map]]
