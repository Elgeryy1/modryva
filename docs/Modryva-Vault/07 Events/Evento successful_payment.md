---
id: modryva-event-successful-payment
title: Evento successful_payment
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

# Evento successful_payment

## Qué es
Confirmación de un pago con Telegram Stars completado. 3 referencias en `apps/bot/src`
(`handleSuccessfulPayment`).

## Consumidores
[[Bot Update Service]] `handleSuccessfulPayment` → según el payload acredita: fichas
(`creditPurchase` idempotente por `chargeId`, rama `chips:`) o pack de IA. Ver [[Chip Economy]],
[[Módulo payments]], [[Comando aipack]].

## Persistencia / idempotencia
[[Modelo Payment]] con `chargeId` @unique (el crédito se hace DENTRO del `recordPayment` en un
`$transaction`, nunca en un segundo paso) → sin doble crédito.

## Relaciones
- Pertenece a: [[Events Map]]
- Consume: [[Evento pre_checkout_query]]
- Produce: [[Modelo Payment]]
- Relacionado con: [[Integración Telegram Stars]], [[Chip Economy]], [[Comando aipack]]
