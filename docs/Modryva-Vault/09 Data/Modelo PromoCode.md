---
id: modryva-model-promocode
title: Modelo PromoCode
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

# Modelo PromoCode

## Propósito
Código promocional canjeable que concede un [[Modelo Entitlement]] (p. ej. un slot de bot gestionado).
Se guarda el hash del código (no el texto) más un prefijo visible. Tabla `promo_codes`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `codeHash` | String | `@unique` (se guarda hash, no el código). |
| `codePrefix` | String | Prefijo mostrable. |
| `kind` | [[Enum EntitlementKind]] | Qué concede. |
| `template` | [[Enum ManagedBotTemplate]] | `@default(community)`. |
| `quantity` / `maxUses` / `usedCount` | Int | Cupo y consumo. |
| `expiresAt` / `revokedAt` | DateTime? | Caducidad / revocación. |
| `note` | String? | Nota interna. |
| `createdByTelegramId` | BigInt | Emisor. |

## Índices / restricciones
`codeHash @unique`; `@@index([tenantId])`, `@@index([createdByTelegramId])`. Relación
`redemptions PromoRedemption[]`.

## Enums usados
[[Enum EntitlementKind]], [[Enum ManagedBotTemplate]]

## Acceso
`platform-repository.ts` (crear código, validar y canjear → crea `Entitlement` + `PromoRedemption`).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo PromoRedemption]], [[Modelo Entitlement]]
- Relacionado con: [[Modelo Tenant]], [[Modryva Hub Map]], [[Database Map]]
