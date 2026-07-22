---
id: modryva-model-product
title: Modelo Product
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

# Modelo Product

## Propósito
Producto vendible por Telegram Stars en un chat (título, importe, divisa). Tabla `products`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `productId` | String | Id lógico. |
| `title` | String | Nombre. |
| `amount` | Int | Precio. |
| `currency` | String | `@default("XTR")` (Stars). |
| `active` | Boolean | `@default(true)`. |

## Índices / restricciones
`@@unique([tenantId, productId])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`payment-repository.ts` (catálogo; genera [[Modelo Invoice]] al comprar).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Invoice]], [[Modelo Payment]]
- Relacionado con: [[Database Map]]
