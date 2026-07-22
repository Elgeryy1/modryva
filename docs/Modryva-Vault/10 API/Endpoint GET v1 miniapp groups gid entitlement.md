---
id: endpoint-get-v1-miniapp-groups-gid-entitlement
title: Endpoint GET v1 miniapp groups gid entitlement
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/entitlement.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/entitlement]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid entitlement

`status()` en [[Controller entitlement]] (`apps/api/src/miniapp/entitlement.controller.ts:46`). Devuelve el plan/entitlement de la **red (federación)** del grupo.

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

`{ inNetwork, plan, maxChats, chatCount, premiumUntil }` (`view`, `:104`). Si el chat no pertenece a ninguna red, devuelve el default **free** (`plan: "free"`, `maxChats: 3`, `chatCount: 0`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin` (basta admin del grupo para consultar). Sin errores propios.

## Consumidor

`getEntitlementStatus(gid)` en `apps/web/lib/api-entitlement.ts:13`.

## Relaciones

- **Pertenece a**: [[Controller entitlement]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla premium]] (`getEntitlementStatus`).
- **Consume**: [[Modelo Entitlement]], [[Modelo Federation]].
- **Relacionado con**: [[Endpoint POST v1 miniapp groups gid entitlement redeem]], [[Promo Codes y Entitlements]], [[API Map]].
