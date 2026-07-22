---
id: modryva-glossary-idempotencia
title: Idempotencia
type: glossary
domain: glossary
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - glossary
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Idempotencia

Propiedad por la que repetir una operación no cambia el resultado más allá de la primera vez. Modryva la usa
intensamente para tolerar reintentos: colas de entrada ([[Modelo UpdateInbox]], [[Modelo CallbackInbox]],
[[Modelo IdempotencyKey]]), pagos por `chargeId` @unique ([[Modelo Payment]], [[Evento successful_payment]]),
y créditos del casino por `refId`/`reason` ([[Modelo ChipLedger]], bono diario/cashback/rescate).

## Relaciones
- Relacionado con: [[Modelo IdempotencyKey]], [[Chip Economy]], [[Events Map]]
