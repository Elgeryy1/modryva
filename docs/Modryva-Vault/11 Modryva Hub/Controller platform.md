---
id: controller-platform
title: Controller platform
type: controller
domain: platform
status: implemented
maturity: beta
source:
  - apps/api/src/platform.controller.ts
  - packages/data/src/platform-repository.ts
tags: [modryva, controller, platform]
aliases: [PlatformController, v1/platform]
created: 2026-07-12
updated: 2026-07-12
---

# Controller platform

`PlatformController` expone la API HTTP del Hub bajo el prefijo **`v1/platform`**
(`apps/api/src/platform.controller.ts:184`). Todas las rutas pasan por `@UseGuards(InitDataGuard)`: se
autentican con `Authorization: tma <initData>` y resuelven el actor (`ctx.userId`) y el bot servidor por
[[Bot Scoping]].

Construcción (`:192`): instancia `PrismaPlatformRepository(undefined, env.MANAGED_BOT_TOKEN_KEY)` (la
clave de cifrado es necesaria para descifrar tokens de hijos), `HttpTelegramGateway` y
`PrismaAiAccessRepository`.

## Endpoints

| Método | Ruta | Acceso | Qué hace | Línea |
|---|---|---|---|---|
| GET | `me` | cualquiera autenticado | Estado del usuario: `isOwner`, `roles`, `entitlements`, `managedBotSlots`, `bots` (todos si owner, propios si no), `primaryBot`. | `:251` |
| GET | `bots/:username` | owner o dueño del bot | Detalle del bot + chats (enriquece títulos vía `getChat` si faltan). | `:284` |
| POST | `bots/:username/send-message` | solo owner | Envía un mensaje como ese bot (usa token del padre si es primary, o el token descifrado del hijo). Audita `platform.send_message_as_bot`. | `:298` |
| GET | `promos` | `promo_admin` o `auditor` | Lista promos (máx 100). | `:345` |
| POST | `promos` | `promo_admin` | Crea un [[Modelo PromoCode]] (`managed_bot_slot`). | `:351` |
| POST | `promos/:id/revoke` | `promo_admin` | Revoca un promo. | `:372` |
| POST | `grants/custombot` | `bot_factory_admin` | Concede un slot directo (`grantManagedBotSlot`). | `:378` |
| GET | `ai-codes` | solo owner | Lista códigos de acceso a IA. | `:393` |
| POST | `ai-codes` | solo owner | Genera un código de IA (`AiAccessRepository`, 1–3650 días). | `:410` |
| POST | `roles` | solo owner | `grant`/`revoke` de un [[Enum PlatformRole]]. | `:428` |
| POST | `mybots/reactivate` | dueño del bot | Reactiva un bot suspendido: re-setea webhook y consume slot si hace falta. | `:205` |

## Comprobaciones de acceso (guards internos)

- `requireOwner` (`:470`) — exige owner; 403 `platform-owner-required`.
- `requireAccess(allowed)` (`:452`) — owner **o** alguno de los roles permitidos; 403 `platform-access-denied`.
- `requireBotReadAccess` (`:479`) — owner **o** `bot.ownerTelegramId === userId`.
- `isOwner` (`:586`) = `SUPERBOT_OWNER_TELEGRAM_ID === userId` **o** `hasRole(userId, "platform_owner")`.
- `effectiveRoles` (`:594`) — roles de la BD **más**, si el id está en `SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS`,
  los roles `promo_admin`, `bot_factory_admin`, `auditor` (`configuredPlatformAdminRoles`, `:49`).

Detalle de la matriz de permisos en [[Platform Roles y RBAC]].

## Reactivación de un bot suspendido (`mybots/reactivate`)

Flujo en dos fases para no mutar antes de que Telegram acepte el webhook (`:205`–`:249`):
1. `reactivationInfo(username, ownerId)` — valida propiedad y estado `suspended`, descifra el token y
   decide si consume un slot nuevo (`consumesSlot`) o reusa su entitlement si sigue activo.
2. `setWebhook` con un secreto nuevo (`generateWebhookSecret`) a `<base>/telegram/webhook/<username>`,
   con `MANAGED_BOT_ALLOWED_UPDATES` (`:146`).
3. `commitReactivation` — pasa a `active`, guarda el `hashWebhookSecret` y consume el slot si procede.
Motivos de fallo devueltos: `no-slot`, `not-suspended`, `webhook-failed`, `webhook-url-not-https`.

## Serialización

`bigint` → string en las respuestas (`serializeManagedBot :134`, `serializeEntitlement :127`,
`serializeManagedBotChat :140`) para no romper JSON. Los tokens **nunca** se serializan.

## Relaciones

- Pertenece a: [[Modryva Hub Overview]]
- Depende de: [[Package data]], [[Bot Scoping]]
- Utilizado por: [[Pantalla platform]]
- Produce: [[Promo Codes y Entitlements]], [[Managed Bots]]
- Relacionado con: [[Platform Roles y RBAC]], [[Modryva Hub Map]]
