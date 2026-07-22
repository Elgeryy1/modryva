---
id: bot-pipeline
title: Bot Pipeline
type: workflow
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/pipeline.ts
  - packages/telegram/src/normalize.ts
tags:
  - modryva
  - workflow
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Bot Pipeline

Cómo se procesa **un update de Telegram** de principio a fin. La entrada es siempre la misma
(`BotUpdateService.processWebhook`), venga del webhook o del [[Poller]], así que idempotencia, auditoría y
persistencia se comportan idéntico en ambos casos.

## Contratos de la pipeline

`apps/bot/src/pipeline.ts` define las piezas reutilizables:

- **`BotHandlerInput`** — `{ context, update, rawUpdate, botUsername, replyBotUsername, miniAppLink }`.
- **`BotUpdateHandler`** — `{ name, handle(input) → BotReply | null }`. La cadena de handlers se recorre en
  orden y el **primero que devuelve una `BotReply` gana** (`dispatchUpdate`, `bot-update.service.ts:1084`).
- **`BotPostProcessor`** — `{ name, run(input) }`. Efectos secundarios que corren **siempre** tras el
  dispatch (XP, actividad, gamificación, automatizaciones).
- **`BotGuardDecision`** — permite bloquear un update antes de la cadena (p. ej. ban de plataforma).

## Flujo

```mermaid
flowchart TD
  A["Webhook POST /telegram/webhook/:bot<br/>o Poller getUpdates"] --> B["processWebhook<br/>(resuelve token del bot)"]
  B --> C["processWebhookScoped"]
  C --> D["normalizeUpdate → TelegramUpdateEnvelope"]
  D --> E["repository.ensureContext<br/>(tenant/bot/chat/user/membership)"]
  E --> F["repository.claimUpdate<br/>(dedup por botKey+updateId)"]
  F -->|duplicado| G["audit: telegram.update.duplicate<br/>return duplicate:true"]
  F -->|nuevo| H["audit: telegram.update.received"]
  H --> I["runGuards (platformBanBlock)"]
  I -->|bloqueado| J["finishBlockedUpdate + ack + return"]
  I -->|ok| K{{"kind?"}}
  K -->|inline_query| L["handleInlineQuery → answerInlineQuery · return"]
  K -->|guest_message| M["handleGuestMessage → answerGuestQuery · return"]
  K -->|resto| N["dispatchUpdate<br/>(cadena de ~80 handlers, primero gana)"]
  N --> O["runPostProcessors (5)"]
  O --> P["ackCallbackQuery"]
  P --> Q["deliverReply (si hay BotReply)"]
  Q --> R["markUpdateProcessed"]
  R --> S["BotWebhookResult"]
```

## Notas de diseño

- **Inline Mode** y **Guest Chat Mode** cortan la pipeline en seco: responden por sus propios métodos
  (`answerInlineQuery` / `answerGuestQuery`), sin handlers regulares, sin post-procesadores y sin
  `deliverReply` (`bot-update.service.ts:1007-1033`).
- Los post-procesadores corren **aunque ningún handler haya respondido** (analytics/reputación siempre).
- La entrega concreta (editar vs enviar vs dado) la decide [[Delivery]].

La cadena de handlers y los post-procesadores viven todos dentro del God Object; ver [[Bot Update Service]]
para el listado y [[Update Lifecycle]] para el detalle paso a paso.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Depende de: [[Package telegram]], [[Package data]], [[Package domain]]
- Utilizado por: [[App bot]], [[Poller]]
- Relacionado con: [[Bot Update Service]], [[Update Lifecycle]], [[Delivery]], [[Core Handlers]]
