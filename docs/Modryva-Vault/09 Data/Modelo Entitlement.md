---
id: modryva-model-entitlement
title: Modelo Entitlement
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

# Modelo Entitlement

## Propósito
Derecho de uso concedido a un dueño de Telegram: p. ej. slots de bot gestionado, prueba pro o pack de
agencia. Puede venir de promo, pago o concesión manual. Consume `quantity`/`usedQuantity` para saber
cuánto queda. Tabla `entitlements`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `ownerTelegramId` | BigInt | Titular. |
| `kind` | [[Enum EntitlementKind]] | Tipo de derecho. |
| `template` | [[Enum ManagedBotTemplate]] | `@default(community)`. |
| `quantity` / `usedQuantity` | Int | Cupo total / consumido. |
| `source` | [[Enum EntitlementSource]] | promo / payment / manual. |
| `sourceRef` | String? | Referencia (charge id, etc.). |
| `expiresAt` / `revokedAt` | DateTime? | Vigencia. |
| `createdByTelegramId` | BigInt? | Emisor manual. |

## Índices / restricciones
`@@index([tenantId])`, `@@index([ownerTelegramId])`, `@@index([kind])`. Relación
`redemptions PromoRedemption[]`.

## Enums usados
[[Enum EntitlementKind]], [[Enum ManagedBotTemplate]], [[Enum EntitlementSource]]

## Acceso
`entitlement-repository.ts` y `platform-repository.ts` (crear al canjear/pagar; descontar al crear un
[[Modelo ManagedBot]]).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo PromoRedemption]], [[Modelo ManagedBot]]
- Relacionado con: [[Modelo PromoCode]], [[Modryva Hub Map]], [[Database Map]]
