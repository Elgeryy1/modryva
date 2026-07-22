---
id: modryva-event-my-chat-member
title: Evento my_chat_member
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

# Evento my_chat_member

## Qué es
Cambio del estado del **propio bot** en un chat: lo añaden, lo hacen admin, lo quitan admin o lo expulsan
(5 referencias en `apps/bot/src`). Dispara el onboarding y ajusta capacidades.

## Consumidores
[[Bot Update Service]] → onboarding ([[Comando help]] / handleBotOnboarding): mensaje distinto si el bot es
admin o solo miembro (capacidades "ver ≠ actuar"). Actualiza si el bot puede moderar ([[Security Map]]).

## Persistencia
[[Modelo Chat]] / [[Modelo NativeAdminSnapshot]] (estado de admin), [[Modelo Tenant]].

## Relaciones
- Pertenece a: [[Events Map]]
- Relacionado con: [[Comando help]], [[Security Map]], [[Modryva Hub Map]], [[Evento chat_member]]
