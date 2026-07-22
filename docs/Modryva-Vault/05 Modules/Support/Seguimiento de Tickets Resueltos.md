---
id: modryva-support-ticket-followup
title: Seguimiento de Tickets Resueltos
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/ticket-followup.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Seguimiento de Tickets Resueltos

## Qué hace
Decide si, tras marcar un ticket como resuelto, debe enviarse el mensaje de
seguimiento ("¿Quedó solucionado tu problema?"). `shouldSendTicketFollowup`
envía cuando `nowMs - resolvedMs >= delayMs` (por defecto 24 h,
`DEFAULT_TICKET_FOLLOWUP_DELAY_MS`). Un `delayMs` no positivo o no finito hace
que el seguimiento venza en cuanto pasa cualquier tiempo; un `resolvedMs` futuro
da `elapsedMs = 0` y `send = false`. El texto está en `TICKET_FOLLOWUP_MESSAGE`.

## Evidencia
- `modules/support/src/ticket-followup.ts:41` `shouldSendTicketFollowup`; copy en
  `ticket-followup.ts:11`; retardo por defecto en `ticket-followup.ts:5`.
- Test: `modules/support/src/ticket-followup.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:572` (import) y
  `bot-update.service.ts:16663` (`shouldSendTicketFollowup(...)`), servido por el
  comando `/seguimiento_ticket` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/seguimiento_ticket`. Función pura basada
en reloj inyectado; el disparo automático real (scheduler) no se verifica aquí.

## Preguntas abiertas
- No verificado si existe un job programado que llame a esta decisión
  periódicamente, o si solo se evalúa bajo demanda vía el comando → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Tickets de Soporte]], [[Encuestas CSAT]], [[Modelo Ticket]]
