---
id: endpoint-get-v1-miniapp-groups-gid-network-analytics
title: Endpoint GET v1 miniapp groups gid network analytics
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/network-analytics.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/network/analytics]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid network analytics

`analyticsView()` en [[Controller network-analytics]] (`apps/api/src/miniapp/network-analytics.controller.ts:76`). Analítica agregada de todos los chats de la red.

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

`NetworkAnalyticsPayload` (`:52`): `{ chatCount, totalMessages, activeUsers, recentDays, topPosters, hourlyRaidSpamEvents, unconfiguredChats, healthScore, recommendations }` (`buildAnalytics`, `:112`). `healthScore` pondera captcha/antiflood/d1/welcome; `recommendations` son acciones del "doctor" (`enable-captcha`, `enable-antiflood`, `configure-welcome`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `requireNetworkAdmin` (`:331`). Si el chat no está en red se trata como red de un solo chat; si lo está exige owner/fed-admin → 403 `not-network-admin`.

## Consumidor

`getNetworkAnalytics(gid)` en `apps/web/lib/api-analytics.ts:41`. El arreglo del doctor es `applyDoctorFix(gid, recommendationId)` (`api-analytics.ts:44` → `POST .../network/doctor/fix`).

## Relaciones

- **Pertenece a**: [[Controller network-analytics]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla analytics]] (`getNetworkAnalytics`).
- **Consume**: [[Modelo Analytics]], [[Modelo Federation]].
- **Relacionado con**: [[Controller network-risk]], [[API Map]].
