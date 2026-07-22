---
id: endpoint-post-v1-miniapp-groups-gid-ai-pack-invoice
title: Endpoint POST v1 miniapp groups gid ai-pack invoice
type: endpoint
domain: api
status: implemented
maturity: beta
source: [apps/api/src/miniapp/ai-pack.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/ai-pack/invoice]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid ai-pack invoice

`chatInvoice()` en [[Controller ai-pack]] (`apps/api/src/miniapp/ai-pack.controller.ts:63`). Crea un **link de factura de Telegram Stars** para suscribir el grupo al Pack de IA.

## Entrada

- Path: `:gid`. Sin body. Cabecera `Authorization: tma <initData>`.

## Salida

`{ url }` — link de la factura (`createInvoice`, `:184`). La factura usa `currency: "XTR"`, `amount: AI_PACK_STARS_PRICE`, `subscriptionPeriodSeconds: AI_PACK_SUBSCRIPTION_PERIOD_SECONDS` (30 días) y `payload: ai_pack:chat:<telegramChatId>`.

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin` + `resolveChat`. Usa el token del bot servidor (`bot.token`). Error: 400 `invoice-link-failed` si Telegram no devuelve url (`:200`).

## Consumidor

`createChatAiPackInvoice(gid)` en `apps/web/lib/api-ai-pack.ts:18`.

## Relaciones

- **Pertenece a**: [[Controller ai-pack]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/telegram` (`HttpTelegramGateway.createInvoiceLink`).
- **Utilizado por**: [[Pantalla ai-pack]] (`createChatAiPackInvoice`).
- **Consume**: [[Modelo AiSubscription]].
- **Relacionado con**: [[Endpoint GET v1 miniapp groups gid ai-pack]], [[API Map]].
