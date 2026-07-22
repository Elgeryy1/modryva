---
id: update-lifecycle
title: Update Lifecycle
type: workflow
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/ARCHITECTURE.md
tags:
  - modryva
  - workflow
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Update Lifecycle

Detalle paso a paso de `processWebhookScoped` (`apps/bot/src/bot-update.service.ts:919-1053`), el corazón
de la ingesta. Complementa el diagrama de [[Bot Pipeline]].

## Pasos

1. **Resolver token** — `processWebhook` (`:909`) llama `resolveBotToken(botUsername)` (token del managed
   bot o el primario) y ejecuta el resto dentro de un `AsyncLocalStorage` (`botTokenScope`) para que todo
   el árbol de llamadas envíe con el token correcto (multi-bot).
2. **Normalizar** — `normalizeUpdate(rawUpdate, botUsername)` → `TelegramUpdateEnvelope` (ver
   [[Package telegram]]).
3. **`ensureContext`** — crea/actualiza tenant, bot, chat, user y membership; devuelve `FoundationContext`
   (`tenantId`, `userId`, …).
4. **`claimUpdate`** — deduplica por `botKey + updateId` en `update_inbox`. Si **no** se reclama:
   audita `telegram.update.duplicate` y retorna `{ duplicate: true, handled: false }` (`:938-955`).
5. **Auditar** — `telegram.update.received` con actor, recurso y payload normalizado (kind, chatId, userId,
   command) (`:957-972`).
6. **Guards** — `runGuards` (`:1055`) evalúa `platformBanBlock`; si bloquea, `finishBlockedUpdate` entrega
   el aviso, hace `ack` y marca procesado.
7. **Short-circuits** — `inline_query` → `handleInlineQuery`; `guest_message` → `handleGuestMessage`. Ambos
   responden por su método propio y **terminan** la pipeline.
8. **Dispatch + efectos** — `dispatchUpdate` (cadena de handlers, primero que responde gana) →
   `runPostProcessors` → `ackCallbackQuery` → `deliverReply` (si hay `BotReply`) → `markUpdateProcessed`.

## Resultado

Todas las ramas devuelven **`BotWebhookResult`** (`:662-668`):

```ts
{ ok: true, updateId, duplicate, handled, replyDelivered }
```

## Garantías

- **Idempotencia por bot**: el mismo `updateId` no se procesa dos veces (`claimUpdate` + `update_inbox`).
- **Auditoría**: cada update deja rastro (`recibido` o `duplicado`) con actor y payload.
- **Aislamiento multi-bot**: el token viaja por `AsyncLocalStorage`, no por parámetro, así que cualquier
  llamada al gateway usa el bot correcto sin pasarlo a mano.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Depende de: [[Package data]] (`FoundationRepository`), [[Package telegram]]
- Utilizado por: [[App bot]]
- Relacionado con: [[Bot Pipeline]], [[Bot Update Service]], [[Poller]], [[Database Map]]
