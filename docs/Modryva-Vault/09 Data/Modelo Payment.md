---
id: modryva-model-payment
title: Modelo Payment
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/payment-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Payment

## Propósito
Pago confirmado (Telegram Stars) de un usuario por un producto. `chargeId` es la clave de idempotencia
(un pago por cargo). Tabla `payments`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Pagador. |
| `productId` | String | Producto. |
| `chargeId` | String | `@unique` (idempotencia). |
| `amount` / `currency` | Int / String | Importe (`@default("XTR")`). |

## Índices / restricciones
`chargeId @unique`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`payment-repository.ts` (registrar pago al recibir `successful_payment`).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Invoice]], [[Modelo Product]], [[Modelo ChipLedger]], [[Database Map]]
