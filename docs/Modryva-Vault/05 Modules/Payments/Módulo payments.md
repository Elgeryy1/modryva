---
id: modryva-module-payments
title: Módulo payments
type: module
domain: payments
status: partial
maturity: beta
source:
  - modules/payments/src
tags:
  - modryva
  - module
  - payments
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo payments

## Propósito
Lógica de pagos con **Telegram Stars** (productos, invoices, cobro idempotente). Paquete pequeño
`@superbot/module-payments` (`payments.ts` + `index.ts`, 1 test).

## Datos
[[Modelo Product]] · [[Modelo Invoice]] · [[Modelo Payment]]. El crédito idempotente se ancla por
`chargeId` (patrón visto en el casino: hook DENTRO de `recordPayment`, nunca en un segundo paso). Ver
[[Chip Economy]] (packs de fichas) y [[Comando aipack]] (packs de IA).

## Flujo
`pre_checkout_query` → aprobar → `successful_payment` → acreditar. Ver [[Evento pre_checkout_query]] y
[[Evento successful_payment]].

## Cableado
`partial`: la lógica de pago vive aquí, pero los flujos concretos de chips/IA se cablean en el bot
(`handlePreCheckout`/`handleSuccessfulPayment`). Confirmar alcance exacto.

## Relaciones
- Pertenece a: [[Modules Map]]
- Produce: [[Modelo Payment]]
- Consume: [[Modelo Product]], [[Modelo Invoice]]
- Relacionado con: [[Integración Telegram Stars]], [[Chip Economy]]
