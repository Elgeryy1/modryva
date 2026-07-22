---
id: package-telegram
title: Package telegram
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - packages/telegram/src/index.ts
  - packages/telegram/src/gateway.ts
  - packages/telegram/src/normalize.ts
  - packages/telegram/src/parse-command.ts
tags:
  - modryva
  - architecture
  - integration
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Package telegram

`@superbot/telegram` encapsula **toda la interacción con la Bot API de Telegram**: normalización de
updates entrantes y el gateway de salida. Es el único sitio que conoce la forma cruda de la API.

## Qué exporta

`packages/telegram/src/index.ts`:

- `gateway.ts` — la interfaz **`TelegramGateway`** y su implementación **`HttpTelegramGateway`** con ~40
  métodos: `sendMessage`, `sendChatAction`, `editMessageText`, `banChatMember`, `restrictChatMember`,
  `unbanChatMember`, `deleteMessage`, `sendDice`, `sendInvoice`/`createInvoiceLink`/`answerPreCheckoutQuery`
  (pagos con Stars), `answerInlineQuery`, `answerGuestQuery`, `pinChatMessage`, `promoteChatMember`,
  `getChatAdministrators`, `getChatMember`, `answerCallbackQuery`, `setChatMenuButton`, `setMyCommands`,
  `setWebhook`, `getMe`, `getManagedBotToken`/`replaceManagedBotToken`… (`gateway.ts:122-245`).
- `normalize.ts` — **`normalizeUpdate`**: convierte el payload crudo de Telegram en el
  `TelegramUpdateEnvelope` de [[Package domain]]. Es el primer paso de [[Bot Pipeline]].
- `parse-command.ts` — parseo de comandos (`NormalizedCommand`).
- `quote-renderer.ts` — `HttpQuoteRenderer` (render de citas vía API externa, endpoint configurable con
  `QUOTE_API_URL`).
- `spam-check.ts` — `HttpSpamCheckProvider` (consulta de spammers conocidos).

## Quién lo usa

- [[App bot]]: inyecta `HttpTelegramGateway`, `HttpQuoteRenderer`, `HttpSpamCheckProvider` en `app.module.ts`;
  [[Poller]] usa `HttpTelegramGateway` para `setChatMenuButton`/`setMyCommands`; [[Delivery]] lo usa para
  enviar/editar; `processWebhookScoped` llama `normalizeUpdate`.
- [[App worker]]: usa `HttpTelegramGateway` en todos los procesadores.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package domain]]
- Utilizado por: [[App bot]], [[App worker]], [[Bot Update Service]], [[Delivery]], [[Poller]]
- Relacionado con: [[Integración Telegram Bot API]], [[Update Lifecycle]]
