---
id: endpoint-get-v1-miniapp-groups-gid-ai-pack
title: Endpoint GET v1 miniapp groups gid ai-pack
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/ai-pack.controller.ts]
tags: [modryva, endpoint, api]
aliases: [GET /v1/miniapp/groups/:gid/ai-pack]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint GET v1 miniapp groups gid ai-pack

`chatStatus()` en [[Controller ai-pack]] (`apps/api/src/miniapp/ai-pack.controller.ts:46`). Estado de la suscripción al Pack de IA de un **grupo**.

## Entrada

- Path: `:gid`. Cabecera `Authorization: tma <initData>`.

## Salida

`{ scope: "chat", priceStars, subscription }` (`:56`). `subscription` = `{ active, canceled, currentPeriodEnd }` o `{ active: false, canceled: false, currentPeriodEnd: null }` si no hay (`serializeSubscription`, `:27`). `priceStars` = `AI_PACK_STARS_PRICE`.

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin` + `resolveChat`. La suscripción se busca por `getSubscription("chat", telegramChatId)`. Sin errores propios.

## Consumidor

`getChatAiPackStatus(gid)` en `apps/web/lib/api-ai-pack.ts:15`.

## Relaciones

- **Pertenece a**: [[Controller ai-pack]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla ai-pack]] (`getChatAiPackStatus`).
- **Consume**: [[Modelo AiSubscription]].
- **Relacionado con**: [[Endpoint POST v1 miniapp groups gid ai-pack invoice]], [[API Map]].
