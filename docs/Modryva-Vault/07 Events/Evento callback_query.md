---
id: modryva-event-callback-query
title: Evento callback_query
type: event
domain: event
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - event
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Evento callback_query

## Qué es
Pulsación de un botón inline (teclado adjunto a un mensaje). Muy usado (34 referencias en `apps/bot/src`):
menús de config inline, aceptar/cancelar duelo, revisión de moderación, etc.

## Consumidores
[[Bot Update Service]] enruta por el `data` del callback (p.ej. `duel:accept:<id>`, config inline, inbox de
moderación). Cada dominio define su prefijo.

## Persistencia
Idempotencia por [[Modelo CallbackInbox]].

## Relaciones
- Pertenece a: [[Events Map]]
- Consume: [[Modelo CallbackInbox]]
- Relacionado con: [[Bot Update Service]], [[Comando config]], [[Casino Map]]
