---
id: moc-events
title: Events Map
type: moc
domain: event
status: partial
maturity: alpha
tags:
  - modryva
  - moc
  - event
created: 2026-07-12
updated: 2026-07-12
---

# Events Map

Eventos/updates que el bot procesa y las señales internas que produce. Notas en `07 Events/`.
Fuente: tipos de update de Telegram manejados en `apps/bot/src` + colas de entrada Prisma.

## Updates de Telegram (entrada)

- [[Evento message]] · [[Evento edited_message]] · [[Evento callback_query]] ·
  [[Evento chat_member]] · [[Evento my_chat_member]] · [[Evento pre_checkout_query]] ·
  [[Evento successful_payment]] · [[Evento chat_join_request]]

> Verificar cuáles se manejan realmente en el código (marcar `unknown` los no confirmados).

## Colas de entrada (persistencia idempotente)

- [[Modelo UpdateInbox]] · [[Modelo CallbackInbox]] · [[Modelo IdempotencyKey]]

## Señales internas

- Auditoría → [[Modelo AuditLog]] · Alertas → [[Modelo SecurityAlert]]
- Salida asíncrona → [[Modelo JobOutbox]] → [[Workflows Map]]

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Bot Core Map]], [[Commands Map]], [[Workflows Map]], [[Database Map]]
