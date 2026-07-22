---
id: delivery
title: Delivery
type: component
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/delivery.ts
tags:
  - modryva
  - component
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Delivery

`apps/bot/src/delivery.ts` decide **cómo** se manda una `BotReply` a Telegram. [[Bot Update Service]]
delega en él a través de `deliverReply` (`bot-update.service.ts:1858`), pasando el gateway de
[[Package telegram]] y el token del bot en curso.

## `deliverBotReply(...)`

Elige el método del gateway según la forma de la `BotReply` y el tipo de update (`:26`):

1. **Edición en línea** — si `reply.edit`, el update es `callback_query` y hay `callbackInlineMessageId`:
   `editMessageText` sobre el mensaje inline. Si Telegram falla, se trata como entregado (el contenido ya
   está en pantalla).
2. **Dado nativo** — si `reply.dice`: `sendDice` con el emoji (🎲 🎯 🏀 ⚽ 🎳 🎰); `text` se ignora.
3. **Edición por `message_id`** — si `reply.edit` en callback y se pudo extraer el `message_id` del mensaje
   del botón (`extractCallbackMessageId`): `editMessageText` con `chatId + messageId`.
4. **Mensaje nuevo** — por defecto: `sendMessage`.

## Fallback de `parseMode`

Si `sendMessage` falla y la reply llevaba `parseMode` (Markdown/HTML), reintenta **una vez** sin
`parseMode` (texto plano) — así un formato roto no tumba la respuesta (`:91-105`). Si aun así falla,
devuelve `{ ok: false }`.

## Helper

- `extractCallbackMessageId(raw)` (`:4`) — navega `callback_query.message.message_id` con guardas de tipo,
  devolviendo `undefined` si la forma no encaja.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Depende de: [[Package telegram]] (`TelegramGateway`), [[Package domain]] (`BotReply`)
- Utilizado por: [[Bot Update Service]]
- Relacionado con: [[Bot Pipeline]], [[Core Handlers]]
