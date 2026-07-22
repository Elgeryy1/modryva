---
id: modryva-event-pre-checkout-query
title: Evento pre_checkout_query
type: event
domain: event
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - event
  - payments
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Evento pre_checkout_query

## Qué es
Consulta previa de Telegram Stars antes de cobrar: el bot debe aprobar (o rechazar) en segundos. 3
referencias en `apps/bot/src` (`handlePreCheckout`).

## Consumidores
[[Bot Update Service]] `handlePreCheckout` → valida el payload (`chips:<pack>:<uid>` para packs de fichas,
o packs de IA) y aprueba si el pack y el precio casan. Ver [[Chip Economy]] y [[Módulo payments]].

## Siguiente paso
Si se aprueba, Telegram cobra y emite [[Evento successful_payment]].

## Relaciones
- Pertenece a: [[Events Map]]
- Produce: [[Evento successful_payment]]
- Relacionado con: [[Integración Telegram Stars]], [[Chip Economy]], [[Módulo payments]]
