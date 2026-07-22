---
id: modryva-support-tickets
title: Tickets de Soporte
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/tickets.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Tickets de Soporte

## Qué hace
Parser de los comandos de tickets. `parseTicketCommand` traduce un update de
Telegram a un `TicketCommand` discriminado con cinco variantes: `create`
(asunto + prioridad opcional `low|normal|high|urgent`), `list`, `close`,
`reopen` y `assign` (id + telegram_user_id del responsable). Devuelve `null`
cuando el comando no le pertenece y un error tipado (`subject-required`,
`id-required`, `assignee-required`) con su cadena de uso cuando faltan
argumentos. La prioridad por defecto es `normal`; un token de prioridad inicial
es opcional en `/ticket`.

## Evidencia
- `modules/support/src/tickets.ts:58` `parseTicketCommand`; comandos aceptados
  en `tickets.ts:36` (`ticket`, `tickets`, `ticketclose`, `ticketreopen`,
  `ticketassign`); prioridades en `tickets.ts:5`.
- Test: `modules/support/src/tickets.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:566` (import) y
  `apps/bot/src/bot-update.service.ts:7313` (`parseTicketCommand(update)` dentro
  de `handleTicketCommand`).

## Estado / cableado
`implemented`: el parser está conectado al handler `handleTicketCommand` del
bot. La lógica de parseo es pura; la persistencia de tickets vive en el
modelo/base de datos (ver relaciones).

## Preguntas abiertas
- No verificado en este módulo cómo se persisten y listan los tickets tras el
  parseo (handler en `apps/bot`) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Comando tickets]], [[Modelo Ticket]], [[Modelo TicketMessage]], [[Historial de Cliente]], [[Seguimiento de Tickets Resueltos]]
