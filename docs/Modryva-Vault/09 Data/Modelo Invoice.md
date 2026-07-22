---
id: modryva-model-invoice
title: Modelo Invoice
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

# Modelo Invoice

## Propósito
Factura emitida para un [[Modelo Product]] a un usuario (payload de Telegram, importe, estado). Tabla
`invoices`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `productId` | String | Producto. |
| `telegramUserId` | BigInt | Comprador. |
| `payload` | String | Payload Telegram (correlación). |
| `amount` / `currency` | Int / String | Importe (`@default("XTR")`). |
| `status` | String | `@default("created")`. |

## Índices / restricciones
`@@index([tenantId, chatId])`. Sin `updatedAt`.

## Enums usados
Ninguno.

## Acceso
`payment-repository.ts` (crear factura; se cierra al confirmar el pago → [[Modelo Payment]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Payment]]
- Relacionado con: [[Modelo Product]], [[Database Map]]
