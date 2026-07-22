---
id: endpoint-post-v1-miniapp-groups-gid-entitlement-redeem
title: Endpoint POST v1 miniapp groups gid entitlement redeem
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/entitlement.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/entitlement/redeem]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid entitlement redeem

`redeem()` en [[Controller entitlement]] (`apps/api/src/miniapp/entitlement.controller.ts:53`). Canjea un código de entitlement para la **federación** del grupo (sube el plan / amplía `maxChats`).

## Entrada

- Path: `:gid`. Body: `{ code }`, validado con `redeemSchema` (`:26`, 1–128 chars).
- Cabecera `Authorization: tma <initData>`.

## Salida

La vista del entitlement actualizada (`view(auth.fed)`, `:74`) — misma forma que `GET .../entitlement`.

## Auth y errores

`@UseGuards(InitDataGuard)` + `requireNetworkAdmin` (`:143`): owner de la federación **o** `isFedAdmin`. Errores: 400 `invalid-body`, 400 `not-in-network` (chat sin red), 403 `not-network-admin`, y 400 con el `reason` del repo si `redeemCode` falla (`:71`).

## Consumidor

`redeemEntitlementCode(gid, code)` en `apps/web/lib/api-entitlement.ts:16`.

## Relaciones

- **Pertenece a**: [[Controller entitlement]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla premium]] (`redeemEntitlementCode`).
- **Consume**: [[Modelo Entitlement]], [[Modelo Federation]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid entitlement]], [[Promo Codes y Entitlements]], [[API Map]].
