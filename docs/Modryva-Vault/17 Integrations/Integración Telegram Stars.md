---
id: modryva-integration-telegram-stars
title: Integración Telegram Stars
type: integration
domain: integration
status: implemented
maturity: beta
source:
  - modules/payments/src/payments.ts
tags:
  - modryva
  - integration
  - payments
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración Telegram Stars

## Qué es
El sistema de pagos de Telegram (Stars ⭐). Única vía de monetización de Modryva: packs de fichas del casino
y packs/suscripción de IA. **No hay cash-out** (ver [[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).

## Flujo
Invoice → [[Evento pre_checkout_query]] (aprobar) → [[Evento successful_payment]] (acreditar idempotente por
`chargeId`). Ver [[Módulo payments]] y [[Chip Economy]].

## Productos
Chip packs (`CHIP_PACKS`: s/m/l), Pack de IA (suscripción mensual). Ver [[Comando aipack]].

## Fallos y resiliencia
Idempotencia por `chargeId` @unique → sin doble crédito ante reintentos.

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[Chip Economy]], [[Módulo ai]]
- Relacionado con: [[Módulo payments]], [[Modelo Payment]]
