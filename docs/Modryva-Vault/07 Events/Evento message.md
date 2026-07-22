---
id: modryva-event-message
title: Evento message
type: event
domain: event
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/pipeline.ts
tags:
  - modryva
  - event
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Evento message

## Qué es
El update principal de Telegram: un mensaje nuevo en un chat. Es la entrada de casi todo (comandos,
moderación ambiental, XP/actividad, detección de estafa, IA por mención).

## Emisor
Telegram (long-polling [[Poller]] o webhook de bots hijos).

## Consumidores
[[Bot Pipeline]] → [[Bot Update Service]] → cadena de handlers: comandos ([[Commands Overview]]),
moderación ambiental ([[Security Map]]), actividad/XP ([[Módulo community]]), IA por mención ([[Módulo ai]]).

## Persistencia
Idempotencia por [[Modelo UpdateInbox]] / [[Modelo IdempotencyKey]]. La actividad agregada alimenta
[[Modelo UserActivity]] / [[Modelo ActivityDaily]] (base del [[Job recap.weekly]]).

## Relaciones
- Pertenece a: [[Events Map]]
- Produce: [[Modelo AuditLog]]
- Consume: [[Modelo UpdateInbox]]
- Relacionado con: [[Bot Pipeline]], [[Commands Overview]], [[Flujo Update de Telegram]]
