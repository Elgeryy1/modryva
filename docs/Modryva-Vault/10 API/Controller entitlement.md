---
id: controller-entitlement
title: Controller entitlement
type: controller
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/entitlement.controller.ts, apps/api/src/miniapp/admin.service.ts]
tags: [modryva, controller, api]
aliases: [MiniappEntitlementController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller entitlement

`MiniappEntitlementController` (`apps/api/src/miniapp/entitlement.controller.ts:38`). Gestiona el **plan/entitlement de la red (federación)** del grupo: consultar el plan (free/premium), canjear un código y —sólo el owner de plataforma— generar códigos. Prefijo `@Controller("v1/miniapp")` con `@UseGuards(InitDataGuard)` (`:37`).

Instancia `PrismaEntitlementRepository` y `PrismaFederationRepository` (`:39`–`:40`); inyecta [[Servicio admin]] (`:42`).

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| GET | `groups/:gid/entitlement` | Vista del plan de la red: `inNetwork`, `plan`, `maxChats`, `chatCount`, `premiumUntil`. Free por defecto si no hay red. | InitDataGuard + admin | `:46` |
| POST | `groups/:gid/entitlement/redeem` | Canjea un código (`{ code }`) para la federación. | InitDataGuard + **network-admin** | `:53` |
| POST | `groups/:gid/entitlement/codes` | Genera un código (`{ plan, maxChats, days }`). | InitDataGuard + **owner de plataforma** | `:77` |

## Autorización

Tres niveles: `authorize` (`:127`) = admin del grupo; `requireNetworkAdmin` (`:143`) exige ser owner de la federación **o** `isFedAdmin` (403 `not-network-admin`); `generateCode` (`:77`) exige que `ctx.userId === SUPERBOT_OWNER_TELEGRAM_ID` (403 `not-platform-owner`). La `view` (`:104`) devuelve el default free (`maxChats: 3`) cuando el chat no pertenece a ninguna red.

## Modelos que toca

[[Modelo Entitlement]] (via `PrismaEntitlementRepository`), [[Modelo Federation]] (resolución de red + conteo de chats).

## Consumido desde apps/web

`getEntitlementStatus` (`apps/web/lib/api-entitlement.ts:13`), `redeemEntitlementCode` (`:16`), `generateEntitlementCode` (`:22`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla premium]] vía `apps/web/lib/api-entitlement.ts`.
- **Consume**: [[Modelo Entitlement]], [[Modelo Federation]].
- **Relacionado con**: [[Promo Codes y Entitlements]], [[Controller owner-network]], [[Endpoint GET v1 miniapp groups gid entitlement]], [[Endpoint POST v1 miniapp groups gid entitlement redeem]], [[API Map]].
