---
id: modryva-model-promoredemption
title: Modelo PromoRedemption
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo PromoRedemption

## Propósito
Registra el canje de un [[Modelo PromoCode]] por un usuario, ligado al [[Modelo Entitlement]] que
generó. El `@@unique` impide que el mismo usuario canjee dos veces el mismo código. Tabla
`promo_redemptions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `promoCodeId` | String | FK → [[Modelo PromoCode]] (`onDelete: Cascade`). |
| `redeemedByTelegramId` | BigInt | Quién canjeó. |
| `entitlementId` | String | FK → [[Modelo Entitlement]] (`onDelete: Cascade`). |
| `redeemedAt` | DateTime | `@default(now())`. |

## Índices / restricciones
`@@unique([promoCodeId, redeemedByTelegramId])`; `@@index([redeemedByTelegramId])`.

## Enums usados
Ninguno.

## Acceso
`platform-repository.ts` (se crea al canjear un código de promo).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo PromoCode]], [[Modelo Entitlement]], [[Modelo ManagedBot]], [[Database Map]]
