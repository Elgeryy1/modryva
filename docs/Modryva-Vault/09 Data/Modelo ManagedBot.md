---
id: modryva-model-managedbot
title: Modelo ManagedBot
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ManagedBot

## Propósito
Un bot de Telegram gestionado por la plataforma: el bot padre y cada bot hijo creado por la fábrica
(estilo GroupHelp). Guarda credenciales cifradas, plantilla, estado y vínculo al entitlement que lo
originó. Tabla `managed_bots`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `telegramBotId` | BigInt? | `@unique`. |
| `username` | String | `@unique`. |
| `ownerTelegramId` | BigInt? | Dueño del bot. |
| `template` | [[Enum ManagedBotTemplate]] | `@default(community)`. |
| `status` | [[Enum ManagedBotStatus]] | `@default(active)`. |
| `encryptedToken` / `tokenFingerprint` / `tokenLastRotatedAt` | String?/DateTime? | Token cifrado + rotación. |
| `webhookSecretHash` | String? | Secreto de webhook (hash). |
| `plan` | String | `@default("free")`. |
| `entitlementId` / `createdViaPromoRedemptionId` | String? | Origen del bot. |
| `lastActivatedAt` / `lastError` / `expiryWarnedAt` | DateTime?/String? | Operación. |
| `isPrimary` | Boolean | `@default(false)` (bot padre). |

## Índices / restricciones
`telegramBotId @unique`, `username @unique`; `@@index([tenantId])`, `@@index([ownerTelegramId])`,
`@@index([status])`.

## Enums usados
[[Enum ManagedBotTemplate]], [[Enum ManagedBotStatus]]

## Acceso
`platform-repository.ts` (fábrica: crear/activar/suspender/revocar, rotación de token) y
`foundation-repository.ts`. Consumido por el flujo de la [[Modryva Hub Map]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Entitlement]], [[Modelo PromoRedemption]]
- Relacionado con: [[Modelo Tenant]], [[Modryva Hub Map]], [[Database Map]]
